import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Team from "./pages/Team";
import SalesLogin from "./pages/sales/Login";
import SetPassword from "./pages/sales/SetPassword";
import SalesLayout from "./pages/sales/SalesLayout";
import SalesDashboard from "./pages/sales/Dashboard";
import Pipeline from "./pages/sales/Pipeline";
import LeadsAll from "./pages/sales/LeadsAll";
import LeadsQueue from "./pages/sales/LeadsQueue";
import LeadsContacts from "./pages/sales/LeadsContacts";
import ActivityPage from "./pages/sales/Activity";
import Followups from "./pages/sales/Followups";
import Campaigns from "./pages/sales/Campaigns";
import HowItWorks from "./pages/sales/HowItWorks";
import SalesSettings from "./pages/sales/Settings";
import Approvals from "./pages/sales/Approvals";
import Wins from "./pages/sales/Wins";
import OAuthConsent from "./pages/OAuthConsent";






const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/sales/login" element={<SalesLogin />} />
            <Route path="/sales/set-password" element={<SetPassword />} />
            <Route path="/sales" element={<ProtectedRoute><SalesLayout /></ProtectedRoute>}>
              <Route index element={<SalesDashboard />} />
              <Route path="pipeline" element={<Pipeline />} />
              <Route path="leads" element={<LeadsAll />} />
              <Route path="leads/queue" element={<LeadsQueue />} />
              <Route path="leads/contacts" element={<LeadsContacts />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="followups" element={<Followups />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="wins" element={<Wins />} />
              <Route path="how-it-works" element={<HowItWorks />} />

            </Route>
            <Route path="/sales/settings" element={<ProtectedRoute><SalesSettings /></ProtectedRoute>} />
            <Route path="/team" element={<AdminRoute><Team /></AdminRoute>} />
            {/* Legacy routes — consolidated into the single Sales dashboard */}
            <Route path="/" element={<Navigate to="/sales" replace />} />
            <Route path="/today" element={<Navigate to="/sales" replace />} />
            <Route path="/pipeline" element={<Navigate to="/sales/pipeline" replace />} />
            <Route path="/sms-templates" element={<Navigate to="/sales" replace />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
