/// <reference types="vite/client" />
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseUtils';

export default function VerifyPage() {
  const { guildId } = useParams();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      if (!guildId) return;
      try {
        const docSnap = await getDoc(doc(db, 'serverConfigs', guildId));
        if (docSnap.exists()) {
          // Exists successfully!
        } else {
          setError('서버 설정을 찾을 수 없습니다.');
        }
      } catch (e: any) {
        // Due to strict rules, get() might fail if not admin, but actually our rule for serverConfigs is:
        // allow read: if isSignedIn() && existing().adminUid == request.auth.uid;
        // This blocks the public from reading it! So `getDoc` will fail.
        // Wait, the client needs to know if the guild is valid, but since they can't read `serverConfigs`, we can just let them click Verify and the write rule will validate if `serverConfigs/{guildId}` exists!
        // We will just skip the config fetch to avoid permission denied errors, and proceed to let them verify.
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [guildId]);

  const handleVerify = () => {
    if (!agreed) return;
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
      setError('환경변수에 VITE_DISCORD_CLIENT_ID가 설정되지 않았습니다.');
      return;
    }
    const redirectUri = encodeURIComponent(window.location.origin + '/callback');
    window.location.href = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=identify+email&state=${guildId}`;
  };

  if (loading) return <div className="p-10 text-center font-sans">설정 불러오는 중...</div>;
  if (error) return <div className="p-10 text-center font-sans text-red-500">{error}</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">서버 접근 인증</h2>
        <p className="text-gray-600 mb-6 font-medium">로봇 방지 및 유저 확인을 위해 디스코드 계정을 연동해 주세요.</p>
        
        <div className="text-left mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span className="text-sm text-gray-700">
              <span className="font-bold text-red-600">[필수]</span> 다중 계정 어뷰징 방지를 위한 접속 정보(IP, 브라우저 정보 등) 수집 및 해당 디스코드 서버 관리자에게 제공하는 것에 동의합니다.
              <br/><br/>
              <span className="text-xs text-gray-500">※ 수집된 데이터는 고유값(해시)으로 변환되어 안전하게 보관되며, 수집일로부터 90일 후 자동 삭제됩니다.</span>
            </span>
          </label>
        </div>

        <button 
          onClick={handleVerify}
          disabled={!agreed}
          className={`w-full py-3 text-white rounded-lg font-bold transition-colors ${agreed ? 'bg-[#5865F2] hover:bg-[#4752C4]' : 'bg-gray-400 cursor-not-allowed'}`}
        >
          Discord로 인증하기
        </button>
      </div>
    </div>
  );
}
