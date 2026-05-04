import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function DiscordCallback() {
  const location = useLocation();
  const [status, setStatus] = useState('인증 정보를 처리하는 중입니다...');
  const [error, setError] = useState('');

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const oldToken = hashParams.get('access_token');
    
    if (oldToken) {
      setError('보안 정책업데이트로 인해 앱을 다시 시작해 주세요. (기존 세션 만료)');
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const code = queryParams.get('code');
    const obfuscatedState = queryParams.get('state');

    // Clean URL immediately to hide the code from address bar and history
    if (code || obfuscatedState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (!code || !obfuscatedState) {
      if (!location.search && !location.hash) return; // Wait for initial load
      setError('잘못된 인증 접근입니다.');
      setStatus('');
      return;
    }

    const guildId = atob(obfuscatedState); // Decode obfuscated Guild ID

    const verify = async () => {
      try {
        const response = await fetch('/api/discord/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, state: guildId })
        });

        const contentType = response.headers.get('content-type');
        if (!response.ok) {
          if (contentType && contentType.includes('application/json')) {
            const errData = await response.json();
            throw new Error(errData.error || '인증 교환 중 오류가 발생했습니다.');
          } else {
            const text = await response.text();
            console.error('Server returned non-JSON error:', text);
            throw new Error(`서버 응답 오류 (HTTP ${response.status}). 관리자에게 문의하세요.`);
          }
        }

        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Unexpected non-JSON response:', text);
          throw new Error('서버로부터 올바른 응답(JSON)을 받지 못했습니다.');
        }

        const data = await response.json();
        const discordTag = data.user.tag;

        // Add an artificial delay to allow the bot time to assign roles
        const loadingMessages = [
          '보안 확인 및 역할 지급 처리 중입니다...',
          '디스코드 계정 보안 상태를 분석하고 있습니다...',
          '서버 관리자 설정과 권한을 동기화 중입니다...',
          '인증 데이터베이스 기록을 최종 검증하고 있습니다...',
          '유저의 정보를 암호화하고 있습니다...',
          '서버 역할 레이어 계층 구조를 검토하는 중입니다...',
          '우회 인증 시도 및 매크로 사용 여부를 체크하고 있습니다...',
          '다중 계정 접속 기록을 대조 확인하고 있습니다...',
          '거의 다 되었습니다! 역할 지급 시스템 호출 중...',
          '마지막으로 지급된 역할의 권한을 확인하고 있습니다...'
        ];
        
        setStatus(loadingMessages[0]);
        let msgIndex = 1;
        
        const messageInterval = setInterval(() => {
          if (msgIndex < loadingMessages.length) {
            setStatus(loadingMessages[msgIndex]);
            msgIndex++;
          } else {
            clearInterval(messageInterval);
          }
        }, 4500); // Change message every 4.5s

        setTimeout(() => {
          clearInterval(messageInterval);
          setStatus(`인증 완료! ${discordTag} 님 환영합니다.`);
        }, 45000); // Total 45s wait time

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
