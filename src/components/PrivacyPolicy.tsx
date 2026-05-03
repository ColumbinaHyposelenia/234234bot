import React from 'react';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 border-b pb-4">개인정보 처리방침</h1>
        
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">1. 개인정보의 수집 및 이용 목적</h2>
            <p>본 서비스는 디스코드 서버 내 다중 계정(다계정) 어뷰징 및 부적절한 접근을 방지하고 커뮤니티의 안전을 유지하기 위해 최소한의 개인정보를 수집 및 이용합니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">2. 수집하는 개인정보 항목</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>필수 수집 항목:</strong> 디스코드 고유 ID(User ID), 디스코드 사용자명, 이메일 주소, 접속 IP 주소, 브라우저 정보(User Agent 식별값)</li>
            </ul>
            <p className="mt-2 text-sm text-gray-500">※ 수집된 접속 IP 주소 등 민감할 수 있는 데이터는 식별할 수 없는 고유값(해시 등)의 형태로 안전하게 처리 및 보관됩니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <p>수집된 개인정보는 원칙적으로 목적 달성 시 익명화되거나 지체 없이 파기됩니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>보존 기간:</strong> 수집일로부터 90일 후 자동 삭제</li>
              <li>다만, 어뷰징 등 비정상적인 접근이 확인된 계정의 정보는 지속적인 차단 및 관리를 위해 서버 관리자의 판단 하에 제한적으로 보관될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">4. 개인정보의 제3자 제공 (해당 디스코드 서버 관리자)</h2>
            <p>본 서비스는 사용자가 인증을 요청한 디스코드 서버의 안전 관리를 목적으로 해당 서버의 관리자에게 아래의 정보를 제공합니다.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><strong>제공받는 자:</strong> 사용자가 접속을 시도하는 디스코드 서버의 소유자 및 관리자 권한을 가진 자</li>
              <li><strong>제공 목적:</strong> 악성 유저 차단 및 다계정 어뷰저 필터링 기록 확인</li>
              <li><strong>제공 항목:</strong> 디스코드 ID, 이메일, IP 기반 고유 해시값</li>
              <li><strong>보유 및 이용 기간:</strong> 서버 관리자의 디스코드 커뮤니티 운영 기간 내 (원칙적으로 90일 후 파기)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">5. 사용자 권리 및 행사 방법</h2>
            <p>사용자는 언제든지 본인의 개인정보 제공 동의를 철회할 수 있으며, 이 경우 해당 디스코드 서버에서의 역할 부여 등 서비스 이용이 제한될 수 있습니다. 인증 차단 해제 및 내역 삭제 요청은 해당 디스코드 서버 관리자에게 문의하여 주시기 바랍니다.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-800 mb-3">6. 개인정보 보호 담당자 및 문의처</h2>
            <p>본 시스템은 각 디스코드 서버의 독립된 관리자에 의해 운영됩니다. 개인정보 관련 문의사항은 인증을 진행하신 디스코드 서버의 관리자에게 문의해주시기 바랍니다.</p>
          </section>

          <div className="pt-8 mt-8 border-t border-gray-100 text-sm text-gray-500">
            <p>본 개인정보 처리방침은 작성일(2026년 5월 4일)부터 적용됩니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
