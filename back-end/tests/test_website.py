import base64
from io import BytesIO
from PIL import Image
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers import website


def valid_png():
    target=BytesIO();Image.new('RGB',(8,8),'green').save(target,format='PNG');return target.getvalue()


@pytest.fixture
def cms_client(db, users):
    app=FastAPI();app.include_router(website.router)
    app.dependency_overrides[website.get_db]=lambda: db
    current=[users[3]]
    app.dependency_overrides[website.get_current_user]=lambda: current[0]
    with TestClient(app) as client:
        yield client,current


def document(locale='en', slug='example', title='Example', revision=0):
    return dict(locale=locale,slug=slug,title=title,expectedRevision=revision,
                sections=[{'type':'text','content':{'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'Hello'}]}]}}])


def create(client, kind='page'):
    result=client.post('/website/entries',json={'kind':kind})
    assert result.status_code==200,result.text
    return result.json()['key']


def test_publication_is_immutable_and_per_language(cms_client):
    client,_=cms_client;key=create(client)
    en=document();assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    assert client.get('/website/public').json()==[]
    assert client.get(f'/website/public/{key}/en').status_code==404
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public/resolve/en/example').json()['title']=='Example'
    en.update(title='Draft title',slug='new-slug',expectedRevision=1)
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    assert client.get('/website/public/resolve/en/example').json()['title']=='Example'
    assert client.get('/website/public/resolve/en/new-slug').status_code==404
    assert client.put(f'/website/entries/{key}/el',json=document('el','paradeigma','Παράδειγμα')).status_code==200
    assert client.get(f'/website/public/{key}/el').status_code==404
    assert client.post(f'/website/entries/{key}/el/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public?locale=el').json()[0]['title']=='Παράδειγμα'
    assert client.post(f'/website/entries/{key}/en/unpublish?expectedRevision=2').status_code==200
    assert client.get('/website/public?locale=en').json()==[]
    assert client.get('/website/public?locale=el').json()[0]['title']=='Παράδειγμα'
    history=client.get(f'/website/entries/{key}/en/history').json()
    assert [h['revision'] for h in history]==[2,1]
    assert history[1]['snapshot']['title']=='Example'


def test_site_roles_are_independent_and_enforced(cms_client,users):
    client,current=cms_client
    current[0]=users[0]
    assert client.get('/website/access').json()['role']=='none'
    assert client.get('/website/entries').status_code==403
    assert client.put('/website/permissions',json={'user_id':users[0].id,'role':'editor'}).status_code==403
    current[0]=users[3]
    assert client.put('/website/permissions',json={'user_id':users[0].id,'role':'contributor'}).status_code==200
    current[0]=users[0];key=create(client)
    assert client.put(f'/website/entries/{key}/en',json=document()).status_code==200
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==403
    assert client.get('/website/permissions').status_code==403
    current[0]=users[3]
    assert client.put('/website/permissions',json={'user_id':users[0].id,'role':'editor'}).status_code==200
    current[0]=users[0]
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    current[0]=users[3]
    assert client.put('/website/permissions',json={'user_id':users[0].id,'role':'none'}).status_code==200
    current[0]=users[0]
    assert client.get('/website/entries').status_code==403


def test_conflicts_and_unsafe_content(cms_client):
    client,_=cms_client;key=create(client)
    doc=document()
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==409
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=0').status_code==409
    second=create(client)
    assert client.put(f'/website/entries/{second}/en',json=doc).status_code==409
    doc['expectedRevision']=1;doc['sections']=[{'type':'button','href':'javascript:alert(1)'}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422
    doc['sections']=[{'type':'text','content':{'type':'script','text':'bad'}}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422
    assert client.get('/website/public').json()==[]


def test_media_and_home(cms_client):
    client,_=cms_client
    assert create(client,'home')==create(client,'home')=='home'
    assert client.get('/website/public/home/en').status_code==404
    payload=base64.b64encode(valid_png()).decode()
    result=client.post('/website/media',json={'filename':'image.png','data':payload})
    assert result.status_code==200,result.text
    image=client.get(result.json()['url'])
    assert image.headers['content-type']=='image/png'
    assert image.headers['x-content-type-options']=='nosniff'
    with Image.open(BytesIO(image.content)) as decoded:
        assert decoded.size==(8,8)
        assert decoded.format=='PNG'
    assert client.post('/website/media',json={'filename':'bad.svg','data':base64.b64encode(b'<svg onload="bad"/>').decode()}).status_code==422


def test_inactive_users_are_denied(cms_client,users):
    client,current=cms_client;users[3].activated=False
    assert client.get('/website/entries').status_code==403


def test_published_url_reservation_and_news(cms_client):
    client,_=cms_client;key=create(client,'post')
    assert client.put(f'/website/entries/{key}/en',json=document(slug='news-one')).status_code==200
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public?locale=en').json()[0]['kind']=='post'
    assert client.put(f'/website/entries/{key}/en',json=document(slug='new-draft-url',revision=1)).status_code==200
    other=create(client,'page')
    assert client.put(f'/website/entries/{other}/en',json=document(slug='news-one')).status_code==200
    assert client.post(f'/website/entries/{other}/en/publish?expectedRevision=1').status_code==409
    assert client.get('/website/public/resolve/en/news-one').json()['key']==key


def test_full_landing_content_and_navigation(cms_client):
    client,_=cms_client;key=create(client,'home')
    doc=document(slug='home');doc['sections']=[{'type':'landing','group':'navigation','values':{'login':'Sign in'},'menu':[{'title':'News','href':'/news'}]},{'type':'landing','group':'features','values':{'landing_features.stories.buddy.point3':'Custom copy','image:buddy':'/landing-media/candidates/buddy-panel-720p.png'}}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.get('/website/public/home/en').status_code==404
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public/home/en').json()['sections']==doc['sections']
    doc['expectedRevision']=1
    for bad in [{'type':'landing','group':'unknown'}, {'type':'landing','group':'hero','values':{'href:hero':'javascript:bad'}}, {'type':'landing','group':'hero','values':{'image:bot':'https://bad.example/image.svg'}}, {'type':'landing','group':'navigation','menu':[{'title':'Bad','href':'//bad.example'}]}]:
        doc['sections']=[bad]
        assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422


def test_menu_destinations_and_icons_are_published_and_validated(cms_client):
    client,_=cms_client;key=create(client,'home')
    doc=document(slug='home');doc['sections']=[{'type':'landing','group':'navigation','menu':[{'title':'Internal','href':'/pages/en/public-page','icon':'robot','linkType':'cms'},{'title':'External','href':'https://example.org','icon':'world','linkType':'url'},{'title':'Home','href':'/landing-page','icon':'','linkType':'cms'}]}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public/home/en').json()['sections']==doc['sections']
    doc['expectedRevision']=1
    for patch in [{'icon':'<svg onload=bad>'},{'icon':{}},{'linkType':'script'},{'linkType':'cms','href':'https://example.org'},{'href':'javascript:alert(1)'}]:
        doc['sections'][0]['menu'][0]={'title':'Bad','href':'/pages/en/public-page','icon':'robot','linkType':'cms',**patch}
        assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422


def test_reusable_feature_components(cms_client):
    client,_=cms_client;key=create(client,'page')
    doc=document(slug='reusable');component={'type':'feature','title':'Reusable image and text','text':'Body','image':'/landing-media/cms/robot.png','alt':'Robot','layout':'image-left','href':'/news','buttonLabel':'Read','cards':[{'title':'','text':'One point'}]}
    doc['sections']=[component,dict(component,title='Second instance')]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public/resolve/en/reusable').json()['sections']==doc['sections']
    doc['expectedRevision']=1
    for patch in [{'layout':'arbitrary'},{'image':'https://bad.example/x.svg'},{'href':'javascript:bad'},{'cards':[{'text':{}}]}]:
        doc['sections']=[{**component,**patch}]
        assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422


def test_people_and_testimonials_with_photos(cms_client):
    client,_=cms_client;key=create(client)
    client.post('/website/media',json={'filename':'portrait.png','data':base64.b64encode(valid_png()).decode()})
    doc=document(slug='team');person={'title':'Example person','text':'Biography or quote','role':'Educator','organization':'Example school','image':'/website/media/1','alt':'Portrait','href':'https://example.org/profile'}
    doc['sections']=[{'type':kind,'cards':[person]} for kind in ('people','testimonials')]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public/resolve/en/team').json()['sections']==doc['sections']
    doc['expectedRevision']=1
    for patch in [{'image':'javascript:bad'},{'image':'https://example.org/track.svg'},{'image':{}},{'role':[]},{'organization':{}},{'alt':42},{'href':'//bad.example'}]:
        doc['sections']=[{'type':'people','cards':[{**person,**patch}]}]
        assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422
    doc['sections']=[{'type':'testimonials','cards':[person]*13}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422


def test_api_tokens_are_one_time_hashed_and_admin_only(cms_client,db,users):
    import hashlib
    from database.database import WebsiteApiToken
    client,current=cms_client
    result=client.post('/website/api-tokens',json={'name':'My PC','expires_in_days':30})
    assert result.status_code==200,result.text
    secret=result.json()['token'];assert secret.startswith('fbwp_')
    assert result.headers['cache-control']=='no-store'
    stored=db.get(WebsiteApiToken,result.json()['id'])
    assert stored.token_hash==hashlib.sha256(secret.encode()).hexdigest()
    assert secret not in str(client.get('/website/api-tokens').json())
    current[0]=users[0]
    assert client.post('/website/api-tokens',json={'name':'Not allowed'}).status_code==403
    assert client.get('/website/api-tokens').status_code==403
    assert client.post(f'/website/api-tokens/{stored.id}/revoke').status_code==403
    current[0]=users[3]
    for body in [{'name':'  '},{'name':'PC','expires_in_days':0},{'name':'PC','expires_in_days':366}]:
        assert client.post('/website/api-tokens',json=body).status_code==422


def test_draft_api_token_can_upload_photos_and_create_private_post(cms_client):
    client,_=cms_client
    secret=client.post('/website/api-tokens',json={'name':'PC'}).json()['token'];headers={'Authorization':'Bearer '+secret}
    media=client.post('/website/api/media',headers=headers,json={'filename':'photo.png','data':base64.b64encode(valid_png()).decode()})
    assert media.status_code==200,media.text
    body=document(slug='api-post');body['photos']=[{'media_id':media.json()['id'],'alt':'Classroom robot'}]
    result=client.post('/website/api/posts',headers=headers,json=body)
    assert result.status_code==201,result.text
    assert result.json()['kind']=='post' and result.json()['url'] is None
    assert website.public_sections(result.json()['sections'])[-1]=={'type':'image','image':media.json()['url'],'alt':'Classroom robot'}
    assert client.get('/website/public/resolve/en/api-post').status_code==404
    body.update(slug='publish-denied',publish=True)
    assert client.post('/website/api/posts',headers=headers,json=body).status_code==403
    body.update(slug='missing-photo',publish=False,photos=[{'media_id':9999}])
    assert client.post('/website/api/posts',headers=headers,json=body).status_code==422
    assert client.get('/website/api-tokens').json()[0]['last_used_at'] is not None


def test_publishing_api_token_and_atomic_url_conflicts(cms_client,db):
    from database.database import WebsiteEntry
    client,_=cms_client
    secret=client.post('/website/api-tokens',json={'name':'Publisher','allow_publish':True}).json()['token'];headers={'Authorization':'Bearer '+secret}
    body=document(slug='published-api');body['publish']=True
    result=client.post('/website/api/posts',headers=headers,json=body)
    assert result.status_code==201,result.text
    assert result.json()['url']=='/news/en/published-api'
    assert client.get(result.json()['url'].replace('/news/','/website/public/resolve/')).status_code==200
    count=db.query(WebsiteEntry).count()
    assert client.post('/website/api/posts',headers=headers,json=body).status_code==409
    assert db.query(WebsiteEntry).count()==count
    body.update(slug='invalid-api',sections=[{'type':'button','href':'javascript:bad'}])
    assert client.post('/website/api/posts',headers=headers,json=body).status_code==422
    body['sections']=[{'type':'landing','group':'navigation','menu':[]}]
    assert client.post('/website/api/posts',headers=headers,json=body).status_code==422


def test_revoked_expired_and_inactive_owner_tokens_are_denied(cms_client,db,users):
    import datetime
    from database.database import WebsiteApiToken
    client,_=cms_client
    def new():return client.post('/website/api-tokens',json={'name':'PC'}).json()
    def post(secret):return client.post('/website/api/posts',headers={'Authorization':'Bearer '+secret},json=document())
    minted=new()
    assert client.post(f"/website/api-tokens/{minted['id']}/revoke").status_code==200
    assert post(minted['token']).status_code==401
    expired=new();db.get(WebsiteApiToken,expired['id']).expires_at=datetime.datetime.utcnow()-datetime.timedelta(seconds=1);db.commit()
    assert post(expired['token']).status_code==401
    for field,value in [('activated',False),('access_revoked',True),('role',users[0].role)]:
        minted=new();old=getattr(users[3],field);setattr(users[3],field,value);db.commit()
        assert post(minted['token']).status_code==401
        setattr(users[3],field,old);db.commit()
    assert post('fbwp_invalid').status_code==401
    assert post('not-a-token').status_code==401


def test_website_api_tokens_do_not_authenticate_normal_platform_routes(db,users):
    from routers.stage_sources import get_current_user
    from utils.utils_jwt import create_access_token
    app=FastAPI();app.include_router(website.router);app.dependency_overrides[website.get_db]=lambda:db
    with TestClient(app) as client:
        session={'Authorization':'Bearer '+create_access_token({'sub':users[3].username})}
        minted=client.post('/website/api-tokens',headers=session,json={'name':'Restricted'}).json()
        api_headers={'Authorization':'Bearer '+minted['token']}
        for path in ['/website/entries','/website/permissions','/website/api-tokens']:
            assert client.get(path,headers=api_headers).status_code==401
        assert client.post('/website/api-tokens',headers=api_headers,json={'name':'Escalation'}).status_code==401
        assert client.post('/website/api/posts',headers=session,json=document()).status_code==401


@pytest.mark.parametrize('kind',['page','post'])
def test_trash_all_languages_restore_and_home_protection(cms_client,kind):
    client,_=cms_client;key=create(client,kind)
    for locale in ('en','el'):
        assert client.put(f'/website/entries/{key}/{locale}',json=document(locale)).status_code==200
        assert client.post(f'/website/entries/{key}/{locale}/publish?expectedRevision=1').status_code==200
    assert client.delete(f'/website/entries/{key}').status_code==200
    assert client.get('/website/entries').json()==[]
    assert client.get('/website/entries?trashed=true').json()[0]['key']==key
    for locale in ('en','el'):
        assert client.get(f'/website/public?locale={locale}').json()==[]
        assert client.get(f'/website/public/{key}/{locale}').status_code==404
        assert client.get(f'/website/public/resolve/{locale}/example').status_code==404
        assert client.put(f'/website/entries/{key}/{locale}',json=document(locale,revision=1)).status_code==404
    assert client.post(f'/website/entries/{key}/restore').status_code==200
    assert client.get('/website/entries?trashed=true').json()==[]
    assert client.get(f'/website/public/{key}/en').status_code==200
    assert len(client.get(f'/website/entries/{key}/el/history').json())==1
    assert client.delete(f'/website/entries/{create(client,"home")}').status_code==409


def test_photo_trash_guards_drafts_published_and_restore_dependencies(cms_client):
    client,_=cms_client
    image=client.post('/website/media',json={'filename':'trash-test.png','data':base64.b64encode(valid_png()).decode()}).json()
    key=create(client);doc=document();doc['sections']=[{'type':'people','cards':[{'title':'Person','text':'Bio','image':image['url']}]}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.delete(image['url']).status_code==409
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.put(f'/website/entries/{key}/en',json=document(revision=1)).status_code==200
    assert client.delete(image['url']).status_code==409  # still in published snapshot
    assert client.delete(f'/website/entries/{key}').status_code==200
    assert client.delete(image['url']).status_code==200
    assert client.get('/website/media').json()==[]
    assert client.get('/website/media?trashed=true').json()[0]['id']==image['id']
    assert client.get(image['url']).status_code==404
    assert client.post(f'/website/entries/{key}/restore').status_code==409
    other=create(client)
    assert client.put(f'/website/entries/{other}/en',json=doc).status_code==409
    assert client.post(image['url']+'/restore').status_code==200
    assert client.post(f'/website/entries/{key}/restore').status_code==200
    assert client.get(image['url']).status_code==200
    assert client.post(f'/website/entries/{key}/en/unpublish?expectedRevision=2').status_code==200
    assert client.delete(image['url']).status_code==200  # historical revisions don't block recovery
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=2').status_code==200


def test_contributor_cannot_trash_or_restore(cms_client,db,users):
    from database.database import WebsitePermission
    client,current=cms_client;key=create(client)
    image=client.post('/website/media',json={'filename':'fixture.png','data':base64.b64encode(valid_png()).decode()}).json()
    db.add(WebsitePermission(user_id=users[0].id,role='contributor'));db.commit();current[0]=users[0]
    for path,method in [(f'/website/entries/{key}','delete'),(f'/website/entries/{key}/restore','post'),(image['url'],'delete'),(image['url']+'/restore','post')]:
        assert getattr(client,method)(path).status_code==403


def test_latest_posts_feed_is_bounded_localized_published_and_uses_snapshot(cms_client,db):
    import datetime
    from database.database import WebsiteEntry,WebsiteTranslation
    client,_=cms_client
    stamp=datetime.datetime(2026,10,1)
    for index in range(13):
        parent=WebsiteEntry(key=f'feed-{index}',kind='post',deleted_at=stamp if index==12 else None)
        db.add(parent);db.flush()
        for language in ('en','el'):
            doc=document(language,f'feed-{index}',f'Published {index}')
            doc['description']=f'Published summary {index}'
            doc['sections']=[{'type':'image','image':'/website/media/1'}]
            db.add(WebsiteTranslation(entry_id=parent.id,locale=language,slug=doc['slug'],title='Changed draft title',description='',sections=[],revision=2,published=doc,published_slug=doc['slug'],published_at=stamp+datetime.timedelta(days=index)))
    draft_key=create(client,'post')
    assert client.put(f'/website/entries/{draft_key}/en',json=document(slug='unpublished')).status_code==200
    page_key=create(client)
    assert client.put(f'/website/entries/{page_key}/en',json=document(slug='a-page')).status_code==200
    assert client.post(f'/website/entries/{page_key}/en/publish?expectedRevision=1').status_code==200
    db.commit()
    for language in ('en','el'):
        result=client.get(f'/website/public/posts/latest?locale={language}')
        assert result.status_code==200,result.text
        posts=result.json();assert len(posts)==10
        assert [p['title'] for p in posts]==[f'Published {i}' for i in range(11,1,-1)]
        assert all(p['locale']==language and p['thumbnail']=='/website/media/1' for p in posts)
        assert all('sections' not in p for p in posts)
        assert posts[0]['description']=='Published summary 11'
    assert client.get('/website/public/posts/latest?locale=fr').json()==[]
    # The component is accepted in any CMS page/post and remains in its published snapshot.
    component=document(slug='a-page',revision=1);component['sections']=[{'type':'latest-posts','title':'News'}]
    assert client.put(f'/website/entries/{page_key}/en',json=component).status_code==200
    assert client.post(f'/website/entries/{page_key}/en/publish?expectedRevision=2').status_code==200
    assert client.get(f'/website/public/{page_key}/en').json()['sections']==component['sections']


def test_post_excerpts_are_short_plain_text_with_body_fallback():
    assert website.post_excerpt({'description':'  A short summary  '})=='A short summary'
    assert website.post_excerpt({'description':'', 'sections':[{'type':'text','content':{'type':'doc','content':[{'type':'paragraph','content':[{'type':'text','text':'Article body preview'}]}]}}]})=='Article body preview'
    assert len(website.post_excerpt({'description':'word '*150}))<=201
    assert website.post_excerpt({'sections':[{'type':'image','image':'/website/media/1'}]})==''


def test_projects_component_validates_publishes_and_protects_uploaded_images(cms_client):
    client,_=cms_client;key=create(client)
    image=client.post('/website/media',json={'filename':'project.png','data':base64.b64encode(valid_png()).decode()}).json()
    component={'type':'projects','title':'European projects','text':'Introduction','cards':[{'title':'S.T.E.P.S.','text':'Description','href':'https://stepsproject.eu/','image':image['url'],'alt':'Project logo'},{'title':'FOSSBot4AI','text':'AI education','href':'https://fossbot4ai.eu/','image':'/landing-media/projects/fossbot4ai-logo.png'}],'image':image['url'],'alt':'EU co-funding','fundingText':'Co-funded through Erasmus+.'}
    doc=document();doc['sections']=[component]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200
    assert client.post(f'/website/entries/{key}/en/publish?expectedRevision=1').status_code==200
    assert client.get(f'/website/public/{key}/en').json()['sections']==[component]
    assert client.delete(image['url']).status_code==409
    doc['expectedRevision']=1
    for patch in [{'fundingText':{}},{'image':[]},{'image':'https://tracker.example/a.png'},{'cards':[{'title':'X','text':'Y','href':'javascript:alert(1)'}]},{'cards':[{'title':'X','text':'Y','image':'https://tracker.example/a.png'}]},{'cards':[{'title':'X','text':'Y'}]*13}]:
        doc['sections']=[{**component,**patch}]
        assert client.put(f'/website/entries/{key}/en',json=doc).status_code==422
    doc['sections']=[{**component,'image':'/landing-media/projects/eu-co-funded.png'}]
    assert client.put(f'/website/entries/{key}/en',json=doc).status_code==200


def test_cms_upload_quota_includes_trashed_media(cms_client,monkeypatch):
    client,_=cms_client
    png=valid_png()
    monkeypatch.setattr(website,'MEDIA_STORAGE_LIMIT_BYTES',len(png)+1)
    payload={'filename':'image.png','data':base64.b64encode(png).decode()}
    first=client.post('/website/media',json=payload)
    assert first.status_code==200
    assert client.delete(first.json()['url']).status_code==200
    assert client.post('/website/media',json=payload).status_code==507


def test_shared_layout_preserves_translations_and_published_snapshots(cms_client):
    client,_=cms_client;key=create(client)
    en=document();en['sections']=[{'id':'intro','type':'banner','title':'Welcome','text':'English'},
        {'id':'team','type':'people','cards':[{'id':'alice','title':'Alice','text':'Teacher'}, {'id':'bob','title':'Bob','text':'Maker'}]}]
    saved=client.put(f'/website/entries/{key}/en',json=en).json()
    el=document('el','paradeigma','Παράδειγμα');el['sections']=[{'id':'intro','type':'banner','title':'Καλώς ήρθατε','text':'Ελληνικά'},
        {'id':'team','type':'people','cards':[{'id':'alice','title':'Αλίκη','text':'Δασκάλα'}, {'id':'bob','title':'Μπομπ','text':'Δημιουργός'}]}]
    assert client.put(f'/website/entries/{key}/el',json=el).status_code==200
    assert client.post(f'/website/entries/{key}/el/publish?expectedRevision=1').status_code==200
    before=client.get(f'/website/public/{key}/el').json()
    saved['sections'].reverse();saved['sections'][0]['cards'].reverse()
    saved['sections'][0]['cards'][0]['href']='https://example.org/bob'
    saved['expectedRevision']=1
    assert client.put(f'/website/entries/{key}/en',json=saved).status_code==200
    translations={t['locale']:t for t in client.get('/website/entries').json()[0]['translations']}
    greek=translations['el']
    assert [s['id'] for s in greek['sections']]==['team','intro']
    assert [c['title'] for c in greek['sections'][0]['cards']]==['Μπομπ','Αλίκη']
    assert greek['sections'][0]['cards'][0]['href']=='https://example.org/bob'
    assert greek['sections'][1]['title']=='Καλώς ήρθατε'
    assert greek['revision']==2
    assert client.get(f'/website/public/{key}/el').json()==before
    # An editor holding the previous Greek draft cannot undo the shared change.
    el['expectedRevision']=1
    assert client.put(f'/website/entries/{key}/el',json=el).status_code==409
    history=client.get(f'/website/entries/{key}/el/history').json()
    assert history[1]['snapshot']['sections'][0]['title']=='Καλώς ήρθατε'
    # Translate text without affecting another language's revision or content.
    greek['expectedRevision']=2;greek['sections'][1]['text']='Νέο κείμενο'
    assert client.put(f'/website/entries/{key}/el',json=greek).status_code==200
    current={t['locale']:t for t in client.get('/website/entries').json()[0]['translations']}
    assert current['en']['revision']==2
    assert current['en']['sections'][1]['text']=='English'


@pytest.mark.parametrize('kind',['page','post','home'])
def test_new_language_inherits_shared_layout_and_cannot_replace_it(cms_client,kind):
    client,_=cms_client;key=create(client,kind)
    en=document();en['sections']=[{'id':'main','type':'feature','layout':'image-left','title':'Source','text':'Text','cards':[{'id':'point','title':'','text':'One'}]}]
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    fr=document('fr-CA','exemple','Exemple');fr['sections']=[{'id':'main','type':'feature','layout':'image-right','title':'Traduit','text':'Texte','cards':[{'id':'point','title':'','text':'Un'}]}, {'type':'button','title':'Extra'}]
    saved=client.put(f'/website/entries/{key}/fr-CA',json=fr)
    assert saved.status_code==200,saved.text
    sections=saved.json()['sections']
    assert len(sections)==1 and sections[0]['layout']=='image-left'
    assert sections[0]['text']=='Texte' and sections[0]['cards'][0]['text']=='Un'
    # Removal is shared, while old revisions remain recoverable.
    updated=saved.json();updated['expectedRevision']=1;updated['sections']=[]
    assert client.put(f'/website/entries/{key}/fr-CA',json=updated).status_code==200
    assert all(t['sections']==[] for t in client.get('/website/entries').json()[0]['translations'])


def test_shared_layout_adopts_legacy_translations_without_losing_copy(cms_client,db):
    from database.database import WebsiteEntry, WebsiteTranslation
    client,_=cms_client;key=create(client)
    parent=db.query(WebsiteEntry).filter_by(key=key).one()
    for locale,title in [('en','English'),('el','Ελληνικά')]:
        db.add(WebsiteTranslation(entry_id=parent.id,locale=locale,slug='legacy',title=title,
            sections=[{'type':'banner','title':title}],revision=1))
    db.commit()
    en=next(t for t in client.get('/website/entries').json()[0]['translations'] if t['locale']=='en')
    en['expectedRevision']=1;en['sections'].append({'id':'new','type':'button','buttonLabel':'Read more','href':'https://example.org'})
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    greek=next(t for t in client.get('/website/entries').json()[0]['translations'] if t['locale']=='el')
    assert greek['sections'][0]['title']=='Ελληνικά'
    assert greek['sections'][1]['id']=='new'
    en['expectedRevision']=2;en['sections'][1]['id']=en['sections'][0]['id']
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==422


def test_shared_menu_destinations_use_each_languages_url(cms_client):
    client,_=cms_client;page=create(client)
    for locale,slug in [('en','about'),('el','sxetika')]:
        assert client.put(f'/website/entries/{page}/{locale}',json=document(locale,slug)).status_code==200
        assert client.post(f'/website/entries/{page}/{locale}/publish?expectedRevision=1').status_code==200
    home=create(client,'home')
    en=document(slug='home');en['sections']=[{'id':'nav','type':'landing','group':'navigation','menu':[{'id':'about','title':'About','linkType':'cms','href':'/pages/en/about','icon':'robot'}]}]
    assert client.put(f'/website/entries/{home}/en',json=en).status_code==200
    el=document('el','home','Αρχική');el['sections']=[{'id':'nav','type':'landing','group':'navigation','menu':[{'id':'about','title':'Σχετικά','linkType':'cms','href':'/pages/el/sxetika'}]}]
    saved=client.put(f'/website/entries/{home}/el',json=el).json()
    assert saved['sections'][0]['menu'][0]=={'id':'about','title':'Σχετικά','linkType':'cms','href':'/pages/el/sxetika','icon':'robot'}
    saved['expectedRevision']=1;saved['sections'][0]['menu'][0]['icon']='world'
    assert client.put(f'/website/entries/{home}/el',json=saved).status_code==200
    english=next(t for t in client.get('/website/entries').json()[0]['translations'] if t['locale']=='en')
    assert english['sections'][0]['menu'][0]['href']=='/pages/en/about'
    assert english['sections'][0]['menu'][0]['title']=='About'
    assert english['sections'][0]['menu'][0]['icon']=='world'
    # Only public content contributes to the public language chooser.
    assert client.get('/website/public/locales').json()==['el','en']
    assert client.put(f'/website/entries/{page}/fr-CA',json=document('fr-CA','a-propos')).status_code==200
    assert client.get('/website/public/locales').json()==['el','en']
    assert client.post(f'/website/entries/{page}/fr-CA/publish?expectedRevision=1').status_code==200
    assert client.get('/website/public/locales').json()==['el','en','fr-CA']
    assert client.delete(f'/website/entries/{page}').status_code==200
    assert client.get('/website/public/locales').json()==[]


def test_repeated_blocks_keep_their_copy_when_reordered(cms_client):
    client,_=cms_client;key=create(client,'post')
    en=document();en['sections']=[{'id':'first','type':'banner','title':'One'}, {'id':'second','type':'banner','title':'Two'}]
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    el=document('el','nea');el['sections']=[{'type':'banner','title':'Ένα'}, {'type':'banner','title':'Δύο'}]
    assert client.put(f'/website/entries/{key}/el',json=el).status_code==200
    en['expectedRevision']=1;en['sections'].reverse()
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    greek=next(t for t in client.get('/website/entries').json()[0]['translations'] if t['locale']=='el')
    assert [s['title'] for s in greek['sections']]==['Δύο','Ένα']


def test_failed_shared_save_rolls_back_other_language_changes(cms_client):
    client,_=cms_client;key=create(client)
    for locale in ['en','el']:
        assert client.put(f'/website/entries/{key}/{locale}',json=document(locale)).status_code==200
    other=create(client)
    assert client.put(f'/website/entries/{other}/en',json=document(slug='reserved')).status_code==200
    before=next(e for e in client.get('/website/entries').json() if e['key']==key)
    update=document(slug='reserved',revision=1);update['sections']=[{'id':'new','type':'banner','title':'Shared change'}]
    assert client.put(f'/website/entries/{key}/en',json=update).status_code==409
    after=next(e for e in client.get('/website/entries').json() if e['key']==key)
    assert after==before


def test_missing_legacy_card_ids_match_existing_layout_ids(cms_client):
    client,_=cms_client;key=create(client)
    en=document();en['sections']=[{'id':'team','type':'people','cards':[{'id':'person','title':'Alice','text':'Teacher'}]}]
    assert client.put(f'/website/entries/{key}/en',json=en).status_code==200
    fr=document('fr','equipe');fr['sections']=[{'type':'people','cards':[{'title':'Alice FR','text':'Professeur'}]}]
    saved=client.put(f'/website/entries/{key}/fr',json=fr).json()
    assert saved['sections'][0]['cards'][0]=={'id':'person','title':'Alice FR','text':'Professeur'}
