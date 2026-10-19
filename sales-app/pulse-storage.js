import {firebaseConfig,salesAppConfig} from './firebase-config.js?v=20261019-firebase1';

const ready=['apiKey','authDomain','projectId','appId'].every(k=>typeof firebaseConfig[k]==='string'&&firebaseConfig[k].trim()&&!firebaseConfig[k].includes('PASTE_'))&&Boolean(salesAppConfig.adminEmail);
export const storageMode=ready?'firebase':'device';
const scope=new URL('../',import.meta.url).pathname;
const localKey='pulse-device-workspace:'+scope;
let sdk,primaryAuth,firestore,localPromise;
export const doc=(_db,collection,id)=>({collection,id:String(id)});
export const collection=(_db,name)=>({collection:name});
export const where=(field,operator,value)=>({field,operator,value});
export const query=(ref,...filters)=>({...ref,filters});
export const serverTimestamp=()=>storageMode==='firebase'&&sdk?sdk.store.serverTimestamp():new Date().toISOString();

async function loadFirebase(){
  if(sdk)return sdk;
  const [app,auth,store]=await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  const instance=app.getApps().find(a=>a.name==='pulse-sales')||app.initializeApp(firebaseConfig,'pulse-sales');
  primaryAuth=auth.getAuth(instance);firestore=store.getFirestore(instance);
  await auth.setPersistence(primaryAuth,auth.browserSessionPersistence);
  sdk={app,auth,store};return sdk;
}

function localDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('This browser cannot save records. Enable browser storage or use a standard browser tab.'));
  if(!localPromise)localPromise=new Promise((resolve,reject)=>{
    const open=indexedDB.open(localKey,1);
    open.onupgradeneeded=()=>{const records=open.result.createObjectStore('records',{keyPath:['collection','id']});records.createIndex('collection','collection');};
    open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);
  });
  return localPromise;
}

async function localRequest(mode,operation){
  const db=await localDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records',mode),store=tx.objectStore('records');let value;
    tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error('Device storage failed'));tx.onabort=()=>reject(tx.error||new Error('Device storage was interrupted'));
    try{const request=operation(store);request.onsuccess=()=>{value=request.result;};request.onerror=()=>reject(request.error);}catch(error){reject(error);}
  });
}

const snapshot=row=>({id:row.id,exists:()=>Boolean(row.data),data:()=>row.data});
export async function getDoc(ref){
  if(storageMode==='firebase'){await loadFirebase();return sdk.store.getDoc(sdk.store.doc(firestore,ref.collection,ref.id));}
  const row=await localRequest('readonly',store=>store.get([ref.collection,ref.id]));return snapshot(row||{id:ref.id,data:null});
}
export async function getDocs(ref){
  if(storageMode==='firebase'){
    await loadFirebase();const c=sdk.store.collection(firestore,ref.collection);
    const filters=(ref.filters||[]).map(f=>sdk.store.where(f.field,f.operator,f.value));
    return sdk.store.getDocs(filters.length?sdk.store.query(c,...filters):c);
  }
  let rows=await localRequest('readonly',store=>store.index('collection').getAll(ref.collection));
  for(const f of ref.filters||[]){if(f.operator!=='==')throw new Error('Unsupported filter');rows=rows.filter(row=>row.data?.[f.field]===f.value);}
  const docs=rows.map(snapshot);return {docs,size:docs.length,empty:!docs.length,forEach:fn=>docs.forEach(fn)};
}
export async function setDoc(ref,data,options={}){
  if(storageMode==='firebase'){await loadFirebase();return options.merge?sdk.store.setDoc(sdk.store.doc(firestore,ref.collection,ref.id),data,{merge:true}):sdk.store.setDoc(sdk.store.doc(firestore,ref.collection,ref.id),data);}
  const db=await localDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('records','readwrite'),store=tx.objectStore('records');
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    if(options.merge){const old=store.get([ref.collection,ref.id]);old.onsuccess=()=>store.put({collection:ref.collection,id:ref.id,data:{...(old.result?.data||{}),...data}});}
    else store.put({collection:ref.collection,id:ref.id,data});
  });
}
export async function updateDoc(ref,data){
  if(storageMode==='firebase'){await loadFirebase();return sdk.store.updateDoc(sdk.store.doc(firestore,ref.collection,ref.id),data);}
  const existing=await getDoc(ref);if(!existing.exists())throw new Error('Record not found');return setDoc(ref,data,{merge:true});
}
export async function deleteDoc(ref){
  if(storageMode==='firebase'){await loadFirebase();return sdk.store.deleteDoc(sdk.store.doc(firestore,ref.collection,ref.id));}
  await localRequest('readwrite',store=>store.delete([ref.collection,ref.id]));
}

export async function deviceSession(name){
  await localDatabase();
  const displayName=String(name||'Pulse Sales').trim().slice(0,100)||'Pulse Sales';
  localStorage.setItem(localKey+':name',displayName);
  return {user:{uid:'device-workspace',email:'',displayName},access:{allowed:true,name:displayName,role:'admin',active:true}};
}
export function rememberedDeviceName(){return localStorage.getItem(localKey+':name')||'Pulse Sales';}

async function resolveUser(user){
  const email=String(user.email||'').toLowerCase(),owner=email===salesAppConfig.adminEmail.toLowerCase().trim();
  let access;
  if(owner)access={name:user.displayName||'Pulse Administrator',email,role:'admin',active:true};
  else{
    const invite=await getDoc(doc(null,'salesInvites',email));
    if(!invite.exists()||invite.data().active===false||!['sales','admin'].includes(invite.data().role))throw new Error('Your Pulse sales access has not been approved. Contact the administrator.');
    access={...invite.data(),email};
  }
  await setDoc(doc(null,'salesUsers',user.uid),{name:access.name,email,role:access.role,active:true,department:'pulse-sales',updatedAt:serverTimestamp()},{merge:true});
  return {user:{uid:user.uid,email,displayName:access.name},access:{...access,allowed:true}};
}
export async function watchCloudSession(callback){
  await loadFirebase();
  return sdk.auth.onAuthStateChanged(primaryAuth,async user=>{
    if(!user){callback(null);return;}
    try{callback(await resolveUser(user));}catch(error){await sdk.auth.signOut(primaryAuth);callback(null,error);}
  });
}
export async function signIn(email,password){await loadFirebase();return sdk.auth.signInWithEmailAndPassword(primaryAuth,email,password);}
export async function signOut(){if(storageMode==='firebase'){await loadFirebase();await sdk.auth.signOut(primaryAuth);}}
export async function resetPassword(email){await loadFirebase();return sdk.auth.sendPasswordResetEmail(primaryAuth,email);}
export async function checkConnection(){if(storageMode==='device'){await localDatabase();return;}await loadFirebase();if(!primaryAuth.currentUser)throw new Error('Sign in first');await getDoc(doc(null,'salesUsers',primaryAuth.currentUser.uid));}

export async function createTeamMember({name,email,role,password}){
  if(storageMode!=='firebase')throw new Error('Configure Pulse Firebase to enable shared staff access.');
  email=String(email||'').toLowerCase().trim();name=String(name||'').trim();
  if(email===salesAppConfig.adminEmail.toLowerCase().trim())throw new Error('This is the protected primary administrator. Create this account in Firebase Authentication, then sign in.');
  if(!name||!/^\S+@\S+\.\S+$/.test(email)||!['sales','admin'].includes(role)||typeof password!=='string'||password.length<6)throw new Error('Enter a full name, valid email, role and a password of at least 6 characters.');
  await loadFirebase();
  if(!primaryAuth.currentUser)throw new Error('Sign in as a Pulse administrator first.');
  const actor=await resolveUser(primaryAuth.currentUser);
  if(actor.access.role!=='admin')throw new Error('Only an administrator can add team members.');
  const instance=sdk.app.getApps().find(a=>a.name==='pulse-account-creator')||sdk.app.initializeApp(firebaseConfig,'pulse-account-creator');
  const creator=sdk.auth.getAuth(instance);
  let created;
  try{
    await sdk.auth.setPersistence(creator,sdk.auth.inMemoryPersistence);
    try{created=await sdk.auth.createUserWithEmailAndPassword(creator,email,password);}catch(error){if(error.code!=='auth/email-already-in-use')throw error;}
    try{
      await setDoc(doc(null,'salesInvites',email),{name,email,role,active:true,department:'pulse-sales',updatedAt:serverTimestamp()},{merge:true});
    }catch(error){
      if(created)await sdk.auth.deleteUser(created.user).catch(()=>{});
      throw error;
    }
    if(created)await sdk.auth.updateProfile(created.user,{displayName:name}).catch(()=>{});
    return created?'Staff account created. The temporary password can be used to sign in.':'Access approved for the existing account. Its password is unchanged; use Forgot password if required.';
  }finally{await sdk.auth.signOut(creator).catch(()=>{});}
}
