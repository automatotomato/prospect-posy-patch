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
import SalesDashboard from "./pages/sales/Dashboard";
import SalesSettings from "./pages/sales/Settings";

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
            <Route path="/sales/login" element={<SalesLogin />} />
            <Route path="/sales" element={<ProtectedRoute><SalesDashboard /></ProtectedRoute>} />
            <Route path="/sales/settings" element={<ProtectedRoute><SalesSettings /></ProtectedRoute>} />
            <Route path="/team" element={<AdminRoute><Team /></AdminRoute>} />
            {/* Legacy routes — consolidated into the single Sales dashboard */}
            <Route path="/" element={<Navigate to="/sales" replace />} />
            <Route path="/today" element={<Navigate to="/sales" replace />} />
            <Route path="/pipeline" element={<Navigate to="/sales" replace />} />
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
