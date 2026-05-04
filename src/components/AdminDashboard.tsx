import React, { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { collection, query, getDocs, doc, setDoc, deleteDoc, where, updateDoc, getDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';

function RoleSelector({ serverId, selectedRoleIds, onChange }: { serverId: string, selectedRoleIds: string[], onChange: (roles: string[]) => void }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const roleDocRef = doc(db, 'serverRoles', serverId);
        const roleDoc = await getDoc(roleDocRef);
        if (roleDoc.exists()) {
          setRoles(roleDoc.data().roles || []);
        } else {
          setError("이 서버의 역할 정보가 없습니다. 디스코드에서 봇의 '/역할동기화' 명령어를 실행한 후 새로고침해주세요.");
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRoles();
  }, [serverId]);

  if (loading) return <div className="text-xs text-gray-500">역할을 불러오는 중...</div>;
  if (error) return <div className="text-xs text-red-500">역할 불러오기 실패: {error}</div>;

  const toggleRole = (roleId: string) => {
    if (selectedRoleIds.includes(roleId)) {
      onChange(selectedRoleIds.filter(id => id !== roleId));
    } else {
      onChange([...selectedRoleIds, roleId]);
    }
  };

  return (
    <div className="mt-2 text-sm border bg-white p-2 flex flex-col gap-1 max-h-32 overflow-y-auto rounded shadow-inner">
      {roles.length === 0 && <div className="text-gray-500 text-xs">선택 가능한 역할이 없습니다.</div>}
      {roles.map(role => (
        <label key={role.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
          <input 
            type="checkbox" 
            checked={selectedRoleIds.includes(role.id)}
            onChange={() => toggleRole(role.id)}
            className="accent-blue-600"
          />
          <span style={{ color: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'inherit'}} className="font-medium">
            {role.name}
          </span>
        </label>
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [newGuildId, setNewGuildId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addingServer, setAddingServer] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      const queryParams = new URLSearchParams(window.location.search);
      const setupGuildId = queryParams.get('guildId');

      if (u) {
        if (setupGuildId && !addingServer) {
          setAddingServer(true);
          try {
            const ref = doc(db, 'serverConfigs', setupGuildId);
            await setDoc(ref, {
              adminUid: u.uid,
              guildId: setupGuildId,
              updatedAt: Date.now()
            }, { merge: true });
            window.history.replaceState({}, document.title, "/");
            await loadData(u.uid); // Ensure data is loaded immediately
          } catch (e: any) {
            handleFirestoreError(e, OperationType.CREATE, `serverConfigs/${setupGuildId}`);
          }
        }
        await loadData(u.uid);
      } else if (setupGuildId && !u) {
         // Auto-login to handle guildId
         const provider = new GoogleAuthProvider();
         signInWithPopup(auth, provider).catch(console.error);
      }
      setLoading(false);
    });
    return unsub;
  }, [addingServer]);

  const loadData = async (uid: string) => {
    try {
      const qSecure = query(collection(db, 'serverConfigs'), where('adminUid', '==', uid));
      const snap = await getDocs(qSecure);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setServers(data);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'serverConfigs');
    }
  };

  const fetchLogsFromApi = async () => {
    try {
      const serverGuildIds = servers.map(s => s.guildId);
      if (serverGuildIds.length === 0) return;

      // Firestore limits 'in' queries to 30 elements
      const chunks = [];
      for (let i = 0; i < serverGuildIds.length; i += 30) {
        chunks.push(serverGuildIds.slice(i, i + 30));
      }

      let allLogs: any[] = [];
      for (const chunk of chunks) {
         const q = query(
           collection(db, 'verificationLogs'), 
           where('guildId', 'in', chunk)
           // Notice: orderBy('verifiedAt', 'desc') might require an index on guildId and verifiedAt, 
           // skipping it to avoid index errors in simple setup. Client sorts the array.
         );
         const logsSnap = await getDocs(q);
         logsSnap.docs.forEach(d => {
            allLogs.push({ id: d.id, ...d.data() });
         });
      }
      
      allLogs.sort((a, b) => b.verifiedAt - a.verifiedAt);
      setLogs(allLogs);
    } catch(e: any) {
      console.error(e);
    }
  }

  useEffect(() => {
    if (user && servers.length > 0) {
      fetchLogsFromApi();
    }
  }, [user, servers]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    }
  };

  const addServer = async () => {
    if(!newGuildId || !user) return;
    try {
      const ref = doc(db, 'serverConfigs', newGuildId);
      await setDoc(ref, {
        adminUid: user.uid,
        guildId: newGuildId,
        updatedAt: Date.now()
      }, { merge: true });
      setNewGuildId('');
      loadData(user.uid);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, `serverConfigs/${newGuildId}`);
    }
  };

  const removeServer = async (id: string) => {
    if(!user) return;
    try {
      await deleteDoc(doc(db, 'serverConfigs', id));
      loadData(user.uid);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `serverConfigs/${id}`);
    }
  };

  const filteredLogs = logs.filter(l => 
    l.discordTag?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    l.userId?.includes(searchQuery) ||
    l.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-5xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-4">Verification Bot Admin Dashboard</h1>
      
      {!user ? (
        <div className="text-center py-20 bg-gray-50 rounded-lg border border-gray-200">
          <h2 className="text-xl mb-4 font-medium text-gray-700">관리자 계정으로 로그인하세요</h2>
          <button 
            onClick={login}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Google로 로그인
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
             <div className="text-blue-900">로그인완료: {user.email}</div>
             <button onClick={() => signOut(auth)} className="text-sm px-3 py-1 bg-white border border-blue-200 rounded text-blue-700 hover:bg-blue-100">로그아웃</button>
          </div>

          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-medium mb-4">새 디스코드 서버 연동</h3>
            <div className="flex gap-2">
              <input 
                type="text" 
                className="flex-1 border p-2 rounded focus:outline-blue-500" 
                placeholder="Discord Server ID (Guild ID)" 
                value={newGuildId}
                onChange={e => setNewGuildId(e.target.value)}
              />
              <button onClick={addServer} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">추가하기</button>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-medium mb-4 pb-2 border-b">연동된 서버 목록</h3>
            {servers.length === 0 ? (
               <div className="text-gray-500 text-center py-8">연동된 서버가 없습니다.</div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {servers.map(s => (
                  <div key={s.id} className="border p-4 rounded-lg flex justify-between items-center bg-gray-50 shadow-sm">
                    <div className="flex-1 mr-4">
                      <div className="font-mono text-lg font-medium">{s.guildId}</div>
                      <div className="text-xs text-gray-500 mb-2">생성일: {new Date(s.createdAt).toLocaleString()}</div>
                      <label className="text-xs text-gray-500 block mb-1">지급할 역할</label>
                      <RoleSelector
                        serverId={s.guildId}
                        selectedRoleIds={s.verifiedRoleIds || []}
                        onChange={async (newRoleIds) => {
                          const oldServers = [...servers];
                          // Optimistic update
                          setServers(servers.map(server => 
                            server.id === s.id ? { ...server, verifiedRoleIds: newRoleIds } : server
                          ));
                          
                          try {
                            await updateDoc(doc(db, 'serverConfigs', s.id), { 
                              verifiedRoleIds: newRoleIds,
                              updatedAt: Date.now()
                            });
                          } catch(err: any) {
                            setServers(oldServers); // Rollback
                            handleFirestoreError(err, OperationType.UPDATE, `serverConfigs/${s.id}`);
                          }
                        }}
                      />
                    </div>
                    <button onClick={() => removeServer(s.id)} className="px-3 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm font-medium">삭제</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xl font-medium mb-4 pb-2 border-b flex justify-between items-center">
              인증 로그 목록
              <input 
                 type="text" 
                 placeholder="검색 (유저 이름, ID, 이메일)"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
                 className="text-sm font-normal border p-1 border-gray-300 rounded focus:outline-blue-500"
              />
            </h3>
            {logs.length === 0 ? (
               <div className="text-gray-500 text-center py-8">기록된 인증 로그가 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-600 border-b">
                      <th className="p-3 text-sm font-medium">서버 ID</th>
                      <th className="p-3 text-sm font-medium">디스코드 닉네임</th>
                      <th className="p-3 text-sm font-medium">디스코드 ID</th>
                      <th className="p-3 text-sm font-medium">이메일</th>
                      <th className="p-3 text-sm font-medium">기기 해시</th>
                      <th className="p-3 text-sm font-medium">IP 정보</th>
                      <th className="p-3 text-sm font-medium">인증 일시</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(l => (
                      <tr key={l.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm font-mono text-gray-600">{l.guildId}</td>
                        <td className="p-3 text-sm font-medium">{l.discordTag}</td>
                        <td className="p-3 text-sm font-mono text-gray-500">{l.userId}</td>
                        <td className="p-3 text-sm text-gray-600">{l.email ? (l.email.split('@')[0].substring(0, 3) + '***@' + l.email.split('@')[1]) : '-'}</td>
                        <td className="p-3 text-sm font-mono text-gray-500">{l.deviceId || '-'}</td>
                        <td className="p-3 text-sm font-mono text-gray-500">{l.maskedIp || '-'}</td>
                        <td className="p-3 text-sm text-gray-500">{new Date(l.verifiedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
