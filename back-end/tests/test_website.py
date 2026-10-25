import base64
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routers import website


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
    payload=base64.b64encode(b'\x89PNG\r\n\x1a\nexample').decode()
    result=client.post('/website/media',json={'filename':'image.png','data':payload})
    assert result.status_code==200,result.text
    image=client.get(result.json()['url'])
    assert image.headers['content-type']=='image/png'
    assert image.headers['x-content-type-options']=='nosniff'
    assert image.content==base64.b64decode(payload)
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
