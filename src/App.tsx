import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Today from "./pages/Today";
import NotFound from "./pages/NotFound";
import SmsTemplates from "./pages/SmsTemplates";
import Team from "./pages/Team";
import SalesLogin from "./pages/sales/Login";
import SalesDashboard from "./pages/sales/Dashboard";

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
            <Route path="/" element={<ProtectedRoute><Today /></ProtectedRoute>} />
            <Route path="/pipeline" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/today" element={<ProtectedRoute><Today /></ProtectedRoute>} />
            <Route path="/sms-templates" element={<AdminRoute><SmsTemplates /></AdminRoute>} />
            <Route path="/team" element={<AdminRoute><Team /></AdminRoute>} />
            <Route path="/sales/login" element={<SalesLogin />} />
            <Route path="/sales" element={<ProtectedRoute><SalesDashboard /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
