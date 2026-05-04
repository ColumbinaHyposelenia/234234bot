import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseUtils';

export default function DiscordCallback() {
  const location = useLocation();
  const [status, setStatus] = useState('인증 정보를 처리하는 중입니다...');
  const [error, setError] = useState('');

  useEffect(() => {
    // Parse implicit grant hash
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const guildId = hashParams.get('state');

    if (!accessToken || !guildId) {
      setError('잘못된 인증 접근입니다.');
      setStatus('');
      return;
    }

    const verify = async () => {
      try {
        // Get user info directly from Discord API
        const userRes = await fetch('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!userRes.ok) throw new Error('Discord 프로필을 가져오는데 실패했습니다.');
        const userData = await userRes.json();
        
        const userId = userData.id;
        const discordTag = userData.discriminator !== '0' ? `${userData.username}#${userData.discriminator}` : userData.username;
        const email = userData.email || '';

        // Get Client IP and Hash it
        let ip = 'unknown';
        try {
          const ipRes = await fetch('https://api.ipify.org?format=json');
          const ipData = await ipRes.json();
          ip = ipData.ip;
        } catch (e) {
          console.warn('IP 가져오기 실패');
        }

        const ua = navigator.userAgent;
        
        // Hash for Device ID
        const msgUint8 = new TextEncoder().encode(`${ip}-${ua}`);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 10);
        const deviceId = `Device-${hashHex}`;
        const maskedIp = ip.includes(':') 
           ? (ip.substring(0, Math.max(ip.lastIndexOf(':'), 0)) + ':***') 
           : (ip.includes('.') ? (ip.substring(0, Math.max(ip.lastIndexOf('.'), 0)) + '.***') : '***');

        // Write directly to Firestore using rules for unauthenticated creation
        const logId = `${guildId}_${userId}`;
        const now = Date.now();
        
        await setDoc(doc(db, 'verificationLogs', logId), {
          guildId,
          userId,
          discordTag,
          email,
          deviceId,
          maskedIp,
          verifiedAt: now,
          expireAt: now + 90 * 24 * 60 * 60 * 1000
        });

        // Add an artificial delay to allow the bot time to assign roles
        setStatus('보안 확인 및 역할 지급 처리 중입니다...');
        
        setTimeout(() => {
          setStatus(`인증 완료! ${discordTag} 님 환영합니다.`);
        }, 20000);

      } catch (e: any) {
         console.error(e);
         if (e.code === 'permission-denied') {
             setError('이 서버는 관리자에 의해 설정되지 않았거나 설정 오류입니다.');
         } else {
             setError(e.message || '인증 정보 처리 중 오류가 발생했습니다.');
         }
         setStatus('');
      }
    };

    verify();
  }, [location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 font-sans">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
        {error ? (
          <div>
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">오류 발생</h2>
            <p className="text-red-500">{error}</p>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{status}</h2>
            {status.includes('완료') ? (
              <p className="text-green-600 mt-4 text-sm font-medium">이제 이 창을 닫고 디스코드로 돌아가셔도 됩니다!</p>
            ) : (
              <p className="text-gray-500 mt-4 text-sm">잠시만 기다려 주세요. 서버 권한을 확인하고 있습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
