import asyncio
import base64
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from database.database import Base, LocalMarketplacePublication, LocalMarketplaceSubmission, LocalStage, MarketplaceModerationOverride, Projects, User
from fastapi import HTTPException
from models.models import UserRole
from routers.courses import StageReference, marketplace_reference
from routers.local_stages import LocalMarketplacePublishRequest, LocalMarketplaceReviewRequest, LocalStageSaveRequest, copy_installed_github_stage, create_local_stage, delete_local_stage, get_local_release_record, get_local_stage_preview, github_stage_provenance, publish_local_stage, review_local_publication, unpublish_local_stage
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from utils.local_stage_storage import (
    MAX_STAGE_RECORD_BYTES,
    LocalStageValidationError,
    copy_provenance,
    decode_preview,
    normalize_local_stage_slug,
    provenance_has_github,
    validate_local_stage_record,
)


class LocalStageStorageTests(unittest.TestCase):
    def test_accepts_regular_stage_record(self):
        size, checksum = validate_local_stage_record({"title": "Demo", "config": [{"type": "floor", "dimensions": [10, 10]}]})
        self.assertGreater(size, 0)
        self.assertEqual(len(checksum), 64)

    def test_rejects_custom_model(self):
        with self.assertRaisesRegex(LocalStageValidationError, "Custom OBJ"):
            validate_local_stage_record({"config": [{"type": "model", "filename": "asset.stl"}]})

    def test_rejects_embedded_assets(self):
        with self.assertRaisesRegex(LocalStageValidationError, "Embedded"):
            validate_local_stage_record({"config": [{"type": "audio", "source": "data:audio/wav;base64,AAAA"}]})

    def test_rejects_oversized_json(self):
        with self.assertRaisesRegex(LocalStageValidationError, "exceeds"):
            validate_local_stage_record({"config": [{"type": "text", "text": "x" * MAX_STAGE_RECORD_BYTES}]})

    def test_copy_provenance_keeps_github_origin(self):
        github = {"sourceType": "github_marketplace", "repoOwner": "creator", "repoName": "fossbot-demo"}
        local = copy_provenance({"sourceType": "local_marketplace", "publicationId": 4}, github)
        next_copy = copy_provenance({"sourceType": "local_marketplace", "publicationId": 8}, local)
        self.assertTrue(provenance_has_github(next_copy))
        self.assertLessEqual(len(next_copy["ancestors"]), 20)

    def test_installed_github_origin_is_recognized(self):
        self.assertTrue(provenance_has_github({"sourceType": "github_stage", "repoOwner": "creator", "repoName": "fossbot-demo"}))

    def test_installed_github_copy_provenance_is_pinned(self):
        provenance = github_stage_provenance("octo", "fossbot-track", "https://github.com/octo/fossbot-track", "stage-blob-sha", "Track")
        self.assertEqual(provenance["sourceType"], "github_stage")
        self.assertEqual(provenance["repoOwner"], "octo")
        self.assertEqual(provenance["repoName"], "fossbot-track")
        self.assertEqual(provenance["stageJsonSha"], "stage-blob-sha")

    def test_installed_github_copy_only_reads_selected_repo(self):
        class Provider:
            def list_installation_repositories(self, token, installation_id):
                return [{"id": 9, "name": "fossbot-track", "owner": {"login": "octo"}, "html_url": "https://github.com/octo/fossbot-track"}]

            def create_installation_token(self, app_jwt, installation_id, repo_id):
                self.repo_id = repo_id
                return "installation-token"

            def read_json_file(self, token, owner, repo, path):
                self.read = (token, owner, repo, path)
                return {"title": "Track", "description": "Installed stage", "config": []}, "stage-blob-sha"

        provider = Provider()
        created = {}

        def create_stage(db, user, record, **kwargs):
            created.update(record=record, **kwargs)
            return SimpleNamespace(id=12)

        with patch("routers.stage_sources.ensure_repo_allowed"), patch("routers.stage_sources.require_connection", return_value=(SimpleNamespace(installation_id="4"), "user-token")), patch("utils.source_providers.get_provider", return_value=provider), patch("utils.github_app_auth.create_github_app_jwt", return_value="app-jwt"), patch("routers.local_stages._create_stage", side_effect=create_stage), patch("routers.local_stages.local_stage_payload", return_value={"id": 12}):
            result = asyncio.run(copy_installed_github_stage(SimpleNamespace(repoOwner="octo", repoName="fossbot-track", slug=None), SimpleNamespace(id=1), SimpleNamespace()))

        self.assertEqual(result, {"id": 12})
        self.assertEqual(provider.repo_id, 9)
        self.assertEqual(provider.read, ("installation-token", "octo", "fossbot-track", "stage.json"))
        self.assertEqual(created["provenance"]["sourceType"], "github_stage")
        self.assertEqual(created["provenance"]["stageJsonSha"], "stage-blob-sha")

    def test_preview_requires_real_png_signature(self):
        invalid = "data:image/png;base64," + base64.b64encode(b"not a png").decode()
        with self.assertRaisesRegex(LocalStageValidationError, "not a PNG"):
            decode_preview(invalid)

    def test_slug_is_bounded_and_normalized(self):
        slug = normalize_local_stage_slug(None, "  My Stage: Lesson #1  ")
        self.assertEqual(slug, "my-stage-lesson-1")
        self.assertLessEqual(len(slug), 100)


class LocalPublicationLifecycleTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        self.db = sessionmaker(bind=engine)()
        self.owner = User(username="owner", firstname="Stage", lastname="Owner", email="owner@example.com", hashed_password="x", role=UserRole.USER)
        self.reviewer = User(username="reviewer", firstname="Stage", lastname="Reviewer", email="reviewer@example.com", hashed_password="x", role=UserRole.ADMIN)
        self.db.add_all((self.owner, self.reviewer))
        self.db.commit()
        record = {"title": "First", "config": [{"type": "floor", "dimensions": [10, 10]}]}
        size, checksum = validate_local_stage_record(record)
        self.stage = LocalStage(user_id=self.owner.id, slug="first", title="First", description="", visibility="private", record=record, record_bytes=size, checksum=checksum)
        self.db.add(self.stage)
        self.db.commit()
        self.db.refresh(self.stage)

    def tearDown(self):
        self.db.close()

    def request(self):
        return LocalMarketplacePublishRequest(title=self.stage.title, description="", tags=[], sharingLicense="CC-BY-4.0", expectedRevision=self.stage.revision)

    def approve(self, submission_id):
        return asyncio.run(review_local_publication(submission_id, LocalMarketplaceReviewRequest(approved=True), self.reviewer, self.db))

    def test_publish_waits_for_review(self):
        response = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.assertEqual(response["submission"]["status"], "pending")
        self.assertIsNone(self.db.query(LocalMarketplacePublication).first())
        approved = self.approve(response["submission"]["id"])
        self.assertEqual(approved["submission"]["status"], "approved")
        self.assertTrue(self.db.query(LocalMarketplacePublication).one().active)

    def test_cancel_pending_publication_request(self):
        pending = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))

        asyncio.run(unpublish_local_stage(self.stage.id, self.owner, self.db))

        submission = self.db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == pending["submission"]["id"]).one()
        self.assertEqual(submission.status, "cancelled")
        self.assertIsNotNone(submission.reviewed_at)
        self.assertEqual(submission.review_reason, "Cancelled when the owner unpublished the stage.")
        self.assertIsNone(self.db.query(LocalMarketplacePublication).first())
        replacement = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.assertEqual(replacement["submission"]["status"], "pending")

    def test_unpublish_cancels_pending_update(self):
        first = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.approve(first["submission"]["id"])
        self.stage.revision = 2
        self.db.commit()
        update = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))

        asyncio.run(unpublish_local_stage(self.stage.id, self.owner, self.db))

        publication = self.db.query(LocalMarketplacePublication).one()
        update_submission = self.db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == update["submission"]["id"]).one()
        approved_submission = self.db.query(LocalMarketplaceSubmission).filter(LocalMarketplaceSubmission.id == first["submission"]["id"]).one()
        self.assertFalse(publication.active)
        self.assertEqual(update_submission.status, "cancelled")
        self.assertEqual(approved_submission.status, "unpublished")

    def test_republish_keeps_old_release_immutable(self):
        first = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.approve(first["submission"]["id"])
        first_release_id = first["submission"]["id"]
        old_record = asyncio.run(get_local_release_record(first_release_id, self.db))

        next_record = {"title": "Second", "config": [{"type": "floor", "dimensions": [20, 20]}]}
        size, checksum = validate_local_stage_record(next_record)
        self.stage.record, self.stage.record_bytes, self.stage.checksum = next_record, size, checksum
        self.stage.title, self.stage.slug, self.stage.revision = "Second", "second", 2
        self.db.commit()
        second = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.approve(second["submission"]["id"])

        self.assertEqual(asyncio.run(get_local_release_record(first_release_id, self.db)), old_record)
        publication = self.db.query(LocalMarketplacePublication).one()
        self.assertEqual(publication.current_submission_id, second["submission"]["id"])
        self.assertEqual(publication.current_submission.slug_snapshot, "second")

    def test_course_reference_pins_approved_local_release(self):
        pending = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.approve(pending["submission"]["id"])
        publication = self.db.query(LocalMarketplacePublication).one()
        reference = StageReference.model_validate({
            "sourceType": "marketplace",
            "marketplaceEntryPath": f"local:{publication.id}",
        })

        normalized = marketplace_reference(reference, self.db)

        self.assertEqual(normalized["sourceType"], "marketplace")
        self.assertEqual(normalized["localStageId"], self.stage.id)
        self.assertEqual(normalized["marketplaceEntryPath"], f"local:{publication.id}")
        self.assertEqual(normalized["commitSha"], f"local-r1-{self.stage.checksum[:12]}")
        self.assertIn(f"/api/local-marketplace/releases/{pending['submission']['id']}/record", normalized["url"])

    def test_course_reference_rejects_hidden_local_release(self):
        pending = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.approve(pending["submission"]["id"])
        publication = self.db.query(LocalMarketplacePublication).one()
        self.db.add(MarketplaceModerationOverride(
            repo_owner=f"local:{publication.id}",
            repo_name="publication",
            source_type="local",
            local_publication_id=publication.id,
            display_owner="owner",
            display_name="first",
            state="hidden",
            active=True,
            reason="Temporarily hidden",
            moderator_user_id=self.reviewer.id,
        ))
        self.db.commit()
        reference = StageReference.model_validate({
            "sourceType": "marketplace",
            "marketplaceEntryPath": f"local:{publication.id}",
        })

        with self.assertRaises(HTTPException) as raised:
            marketplace_reference(reference, self.db)
        self.assertEqual(raised.exception.status_code, 404)

    def test_unpublish_preserves_release_but_remove_blocks_it(self):
        pending = asyncio.run(publish_local_stage(self.stage.id, self.request(), self.owner, self.db))
        self.approve(pending["submission"]["id"])
        asyncio.run(unpublish_local_stage(self.stage.id, self.owner, self.db))
        self.assertEqual(asyncio.run(get_local_release_record(pending["submission"]["id"], self.db))["title"], "First")

        publication = self.db.query(LocalMarketplacePublication).one()
        override = MarketplaceModerationOverride(repo_owner=f"local:{publication.id}", repo_name="publication", source_type="local", local_publication_id=publication.id, display_owner="owner", display_name="first", state="hidden", active=True, reason="Temporarily hidden", moderator_user_id=self.reviewer.id)
        self.db.add(override)
        self.db.commit()
        self.assertEqual(asyncio.run(get_local_release_record(pending["submission"]["id"], self.db))["title"], "First")
        override.state = "removed"
        override.reason = "Unsafe content"
        self.db.commit()
        with self.assertRaises(HTTPException):
            asyncio.run(get_local_release_record(pending["submission"]["id"], self.db))

    def test_referenced_stage_cannot_be_deleted(self):
        self.db.add(Projects(name="Project", description="", project_type="python", code="", user_id=self.owner.id, stage_local_id=self.stage.id))
        self.db.commit()
        with self.assertRaises(HTTPException) as raised:
            asyncio.run(delete_local_stage(self.stage.id, self.owner, self.db))
        self.assertEqual(raised.exception.status_code, 409)

    def test_local_stage_preview_round_trip(self):
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
        data_url = "data:image/png;base64," + base64.b64encode(png).decode()
        record = {"title": "Previewed", "config": [{"type": "floor", "dimensions": [10, 10]}]}

        created = asyncio.run(create_local_stage(LocalStageSaveRequest(record=record, previewDataUrl=data_url), self.owner, self.db))
        self.assertIn(f"/api/local-stages/{created['id']}/preview", created["previewUrl"])

        response = asyncio.run(get_local_stage_preview(created["id"], self.owner, self.db))
        self.assertEqual(response.body, png)
        self.assertEqual(response.media_type, "image/png")


if __name__ == "__main__":
    unittest.main()
