import pytest

from utils.activity_schema import validate_activities, validate_activities_draft


def rich_text(content):
    return [{"key": "content", "type": "rich_text", "version": 1, "required": False, "content": content}]


def text(value, marks=None):
    node = {"type": "text", "text": value}
    if marks:
        node["marks"] = marks
    return node


def paragraph(*children):
    return {"type": "paragraph", "content": list(children)}


def markdown_document():
    return {
        "type": "doc",
        "content": [
            {"type": "heading", "attrs": {"level": 1}, "content": [text("The print() Function")]},
            paragraph(
                text("Use "),
                text("print()", [{"type": "code"}]),
                text(" and read the "),
                text("docs", [{"type": "link", "attrs": {
                    "href": "https://docs.python.org",
                    "target": "_blank",
                    "rel": "noopener noreferrer nofollow",
                    "class": None,
                    "title": None,
                }}]),
                text("."),
            ),
            {"type": "codeBlock", "attrs": {"language": "python"}, "content": [text('print("hi")\n')]},
            {"type": "heading", "attrs": {"level": 3}, "content": [text("Naming rules")]},
            {"type": "orderedList", "attrs": {"start": 2, "type": None}, "content": [
                {"type": "listItem", "content": [paragraph(text("two"))]},
            ]},
            {"type": "bulletList", "content": [
                {"type": "listItem", "content": [paragraph(text("one"))]},
            ]},
            {"type": "blockquote", "content": [paragraph(text("note"))]},
            {"type": "horizontalRule"},
            paragraph(text("bold", [{"type": "bold"}]), text("italic", [{"type": "italic"}])),
            paragraph(),
        ],
    }


def test_markdown_rich_text_documents_pass_draft_and_publish_validation():
    for validate in (validate_activities_draft, validate_activities):
        validate(rich_text(markdown_document()))


@pytest.mark.parametrize("href", ["javascript:alert(1)", "data:text/html,x", "//evil.test", ""])
def test_unsafe_link_targets_are_rejected(href):
    document = {"type": "doc", "content": [paragraph(text("open", [{"type": "link", "attrs": {"href": href}}]))]}
    with pytest.raises(ValueError):
        validate_activities_draft(rich_text(document))


def test_link_marks_cannot_carry_unknown_fields():
    document = {"type": "doc", "content": [paragraph(text("open", [{"type": "link", "attrs": {"href": "https://example.test"}, "extra": True}]))]}
    with pytest.raises(ValueError):
        validate_activities_draft(rich_text(document))


def test_unsupported_nodes_and_headings_are_rejected():
    with pytest.raises(ValueError):
        validate_activities_draft(rich_text({"type": "doc", "content": [{"type": "image", "attrs": {"src": "https://example.test/x.png"}}]}))
    with pytest.raises(ValueError):
        validate_activities_draft(rich_text({"type": "doc", "content": [{"type": "heading", "attrs": {"level": 7}, "content": [text("H")]}]}))
