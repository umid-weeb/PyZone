import { Navigate, Route, Routes } from "react-router-dom";
import AppFrame from "./components/layout/AppFrame.jsx";
import ProtectedRoute from "./components/common/ProtectedRoute.jsx";
import ArenaPage from "./pages/ArenaPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SubmissionsPage from "./pages/SubmissionsPage.jsx";
import LeaderboardPage from "./pages/LeaderboardPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import ProfileDashboardPage from "./pages/profile/ProfileDashboardPage.tsx";
import UserSubmissionsPage from "./pages/profile/UserSubmissionsPage.tsx";
import ProfileSettingsPage from "./pages/profile/ProfileSettingsPage.tsx";
import ProfileIndexRedirect from "./pages/profile/ProfileIndexRedirect.tsx";
import ProblemPage from "./pages/ProblemPage.tsx";
import ContestsPage from "./pages/contest/ContestsPage.tsx";
import ContestPage from "./pages/contest/ContestPage.tsx";
import ContestLeaderboardPage from "./pages/contest/ContestLeaderboardPage.tsx";
import ProblemsPage from "./pages/ProblemsPage.tsx";
import RoadmapPage from "./pages/RoadmapPage.tsx";

export default function App() {
  return (
    <AppFrame>
      <Routes>
        <Route path="/zone" element={<ArenaPage />} />
        <Route path="/problems" element={<ProblemsPage />} />
        <Route path="/problems/:slug" element={<ProblemPage />} />
        <Route path="/roadmap" element={<RoadmapPage />} />
        <Route path="/contest" element={<ContestsPage />} />
        <Route path="/contest/:id" element={<ContestPage />} />
        <Route path="/contest/:id/leaderboard" element={<ContestLeaderboardPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/profile/settings"
          element={
            <ProtectedRoute>
              <ProfileSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:username/submissions"
          element={
            <ProtectedRoute>
              <UserSubmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:username"
          element={
            <ProtectedRoute>
              <ProfileDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfileIndexRedirect />
            </ProtectedRoute>
          }
        />

        {/* Backwards-compatible legacy routes */}
        <Route
          path="/profile-legacy"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile-legacy/:username"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submissions"
          element={
            <ProtectedRoute>
              <ProfileIndexRedirect fallbackTo="/submissions-legacy" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submissions-legacy"
          element={
            <ProtectedRoute>
              <SubmissionsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaderboard"
          element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Navigate to="/profile/settings" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings-legacy"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/rating" element={<Navigate to="/leaderboard" replace />} />
        <Route path="*" element={<Navigate to="/problems" replace />} />
      </Routes>
    </AppFrame>
  );
}
