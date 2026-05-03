/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom';
import AdminDashboard from './components/AdminDashboard.tsx';
import VerifyPage from './components/VerifyPage.tsx';
import DiscordCallback from './components/DiscordCallback.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/verify/:guildId" element={<VerifyPage />} />
        <Route path="/callback" element={<DiscordCallback />} />
      </Routes>
    </BrowserRouter>
  );
}

