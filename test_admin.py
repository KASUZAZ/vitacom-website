"""Integration tests use a temporary project, never the user's content/password."""
import base64, copy, http.cookiejar, json, os, pathlib, shutil, socket, subprocess, sys, tempfile, time, unittest
from urllib.request import Request, build_opener, HTTPCookieProcessor
from urllib.error import HTTPError

class AdminTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(prefix='vitacom-admin-test-')
        cls.root=pathlib.Path(cls.tmp.name)
        for name in ('admin-server.py','content.json','index.html','cms.js'):
            shutil.copy2(pathlib.Path(__file__).parent/name,cls.root/name)
        (cls.root/'dist').mkdir();(cls.root/'assets').mkdir()
        with socket.socket() as sock:
            sock.bind(('127.0.0.1',0));cls.port=sock.getsockname()[1]
        cls.origin=f'http://127.0.0.1:{cls.port}'
        cls.process=subprocess.Popen([sys.executable,str(cls.root/'admin-server.py')],env={**os.environ,'VITACOM_ADMIN_PORT':str(cls.port)},stdout=subprocess.DEVNULL)
        cls.client=build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        for _ in range(50):
            try:cls.request('/api/session');break
            except OSError:time.sleep(.1)
        cls.request('/api/setup',{'password':'Vitacom-test-only-29486'})

    @classmethod
    def tearDownClass(cls):
        cls.process.terminate();cls.process.wait();cls.tmp.cleanup()

    @classmethod
    def request(cls,path,body=None,origin=True,client=None):
        headers={}
        if body is not None:
            headers['Content-Type']='application/json'
            if origin:headers['Origin']=cls.origin
        req=Request(cls.origin+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
        try:
            response=(client or cls.client).open(req)
            raw=response.read()
            return response.status,json.loads(raw) if response.headers.get_content_type()=='application/json' else raw
        except HTTPError as error:
            return error.code,json.loads(error.read())

    def test_login_required_and_private_files_hidden(self):
        anonymous=build_opener()
        self.assertEqual(self.request('/api/state',client=anonymous)[0],401)
        self.assertEqual(self.request('/api/save',{'state':{}},client=anonymous)[0],401)
        self.assertEqual(self.request('/.vitacom-admin/auth.json')[0],404)
        self.assertEqual(self.request('/%2evitacom-admin/auth.json')[0],404)
        self.assertEqual(self.request('/admin-server.py')[0],404)
        self.assertEqual(self.request('/api/setup',{'password':'Another-password'})[0],409)

    def test_origin_and_unsafe_content_rejected(self):
        self.assertEqual(self.request('/api/save',{'state':{}},origin=False)[0],403)
        for href in ('javascript:alert(1)','data:text/html,evil','//evil.example','\\evil.example'):
            payload={'version':1,'pages':{'index':{'fields':{'l0':{'href':href}}}},'theme':{}}
            self.assertEqual(self.request('/api/validate',{'state':payload})[0],400)
        self.assertEqual(self.request('/api/validate',{'state':{'version':1,'pages':{},'theme':{'accent':'red;display:none'}}})[0],400)

    def test_save_persistence_revision_and_history(self):
        _,old=self.request('/api/state')
        new=copy.deepcopy(old)
        new['pages']['index']={'fields':{'t1':{'text':'Teks admin kekal'},'i0':{'hidden':True}},'sections':{'s2':{'hidden':True}},'order':['s1','s0'],'custom':[{'id':'test','title':'Seksyen baharu','text':'Kandungan'}]}
        code,result=self.request('/api/save',{'state':new,'revision':old['revision']})
        self.assertEqual(code,200);self.assertEqual(result['revision'],old['revision']+1)
        self.assertEqual(self.request('/api/state')[1],result)
        self.assertEqual(json.loads((self.root/'content.json').read_text('utf-8')),result)
        self.assertEqual((self.root/'content.json').read_bytes(),(self.root/'dist/content.json').read_bytes())
        self.assertEqual(self.request('/api/save',{'state':new,'revision':old['revision']})[0],409)
        self.assertEqual(self.request('/api/history')[1][0]['state'],old)
        self.assertIn(b'cms.js',self.request('/index.html')[1])

    def test_upload_and_non_image_rejection(self):
        png=base64.b64encode(b'\x89PNG\r\n\x1a\n'+b'test').decode()
        code,result=self.request('/api/upload',{'data':png})
        self.assertEqual(code,200);self.assertTrue((self.root/result['src']).exists())
        self.assertTrue((self.root/'dist'/result['src']).exists())
        self.assertEqual(self.request('/api/upload',{'data':base64.b64encode(b'<svg onload="alert(1)">').decode()})[0],400)

    def test_account_profile_sessions_and_password(self):
        other=build_opener(HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.assertEqual(self.request('/api/login',{'password':'Vitacom-test-only-29486'},client=other)[0],200)
        self.assertGreaterEqual(self.request('/api/account')[1]['sessions'],2)
        self.assertEqual(self.request('/api/profile',{'name':'Pengurus Vitacom'})[0],200)
        self.assertEqual(self.request('/api/account')[1]['name'],'Pengurus Vitacom')
        self.assertEqual(self.request('/api/profile',{'name':' '})[0],400)
        self.assertEqual(self.request('/api/revoke-sessions',{})[0],200)
        self.assertEqual(self.request('/api/account',client=other)[0],401)
        self.request('/api/login',{'password':'Vitacom-test-only-29486'},client=other)
        self.assertEqual(self.request('/api/password',{'currentPassword':'wrong','newPassword':'Updated-password-2026'})[0],400)
        self.assertEqual(self.request('/api/password',{'currentPassword':'Vitacom-test-only-29486','newPassword':'Updated-password-2026'})[0],200)
        self.assertEqual(self.request('/api/account',client=other)[0],401)
        self.assertEqual(self.request('/api/login',{'password':'Vitacom-test-only-29486'},client=other)[0],401)
        self.assertEqual(self.request('/api/login',{'password':'Updated-password-2026'},client=other)[0],200)
        self.assertTrue(self.request('/api/account')[1]['passwordChangedAt'])
        self.request('/api/password',{'currentPassword':'Updated-password-2026','newPassword':'Vitacom-test-only-29486'})
        self.assertEqual(self.request('/api/activity',client=build_opener())[0],401)
        activities=self.request('/api/activity')[1]
        self.assertTrue(any(e['action']=='Kata laluan ditukar' for e in activities))
        self.assertNotIn('Updated-password-2026',json.dumps(activities))

    def test_global_settings_validation_and_persistence(self):
        _,data=self.request('/api/state')
        data['settings']={'announcementEnabled':True,'announcement':'Promosi Vitacom','announcementLabel':'Hubungi kami','announcementLink':'https://example.com'}
        code,result=self.request('/api/save',{'state':data,'revision':data['revision']})
        self.assertEqual(code,200)
        self.assertEqual(self.request('/api/state')[1]['settings'],data['settings'])
        for patch in ({'announcementLink':'javascript:alert(1)'},{'announcementEnabled':'true'},{'announcement':'a'*501}):
            bad=copy.deepcopy(result);bad['settings'].update(patch)
            self.assertEqual(self.request('/api/validate',{'state':bad})[0],400)

    def test_site_health_report(self):
        code,report=self.request('/api/site-health')
        self.assertEqual(code,200)
        self.assertIn(report['status'],('Baik','Perlu perhatian','Kritikal'))
        self.assertGreaterEqual(report['score'],0);self.assertLessEqual(report['score'],100)
        self.assertEqual(report['revision'],self.request('/api/state')[1]['revision'])
        self.assertTrue(any(page['slug']=='index' for page in report['pages']))
        self.assertIsInstance(report['issues'],list)
        self.assertIsInstance(report['diskFree'],int)
        self.assertEqual(self.request('/api/site-health',client=build_opener())[0],401)

if __name__=='__main__':unittest.main(verbosity=2)
