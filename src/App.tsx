import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import CreatorPage from "./pages/CreatorPage";
import Portfolio from "./pages/Portfolio";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import PublicProfile from "./pages/PublicProfile";
import Feed from "./pages/Feed";
import Streams from "./pages/Streams";
import StreamLivePage from "./pages/StreamLivePage";
import SettingsLayout from "./pages/settings/SettingsLayout";
import ProfileSettings from "./pages/settings/ProfilePage";
import AccountSettings from "./pages/settings/AccountPage";
import NotificationsSettings from "./pages/settings/NotificationsPage";
import PaymentsSettings from "./pages/settings/PaymentsPage";
import PrivacySettings from "./pages/settings/PrivacyPage";
import WalletSettings from "./pages/settings/WalletPage";
import ReferralsSettings from "./pages/settings/ReferralsPage";
import SubscriptionsSettings from "./pages/settings/SubscriptionsPage";
import VerificationSettings from "./pages/settings/VerificationPage";
import RatesSettings from "./pages/settings/RatesPage";
import CreatorSettings from "./pages/settings/CreatorPage";
import ProtectedRoute from "@/components/core/ProtectedRoute";
import ProtectedDashboardLayout from "./layouts/ProtectedDashboardLayout";
import { WagmiConfig } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import Subscribe from "./pages/Subscribe";
import SubscriptionsHistory from "./pages/SubscriptionsHistory";
import Marketplace from "./pages/Marketplace";
import GoLive from "./pages/GoLive";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WagmiConfig config={wagmiConfig}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/creator/:slug" element={<CreatorPage />} />
            <Route path="/subscribe" element={<Subscribe />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              element={
                <ProtectedRoute>
                  <ProtectedDashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/streams/live/:id" element={<StreamLivePage />} />
              <Route path="/streams/go-live" element={<GoLive />} />
              <Route path="/streams" element={<Streams />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:username" element={<PublicProfile />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/subscriptions/history" element={<SubscriptionsHistory />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="profile" replace />} />
                <Route path="profile" element={<ProfileSettings />} />
                <Route path="account" element={<AccountSettings />} />
                <Route path="notifications" element={<NotificationsSettings />} />
                <Route path="payments" element={<PaymentsSettings />} />
                <Route path="privacy" element={<PrivacySettings />} />
                <Route path="wallet" element={<WalletSettings />} />
                <Route path="creator" element={<CreatorSettings />} />
                <Route path="referrals" element={<ReferralsSettings />} />
                <Route path="subscriptions" element={<SubscriptionsSettings />} />
                <Route path="verification" element={<VerificationSettings />} />
                <Route path="rates" element={<RatesSettings />} />
              </Route>
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WagmiConfig>
  </QueryClientProvider>
);

export default App;
