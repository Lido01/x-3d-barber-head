import { Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import RequireAdmin from "./components/RequireAdmin";
import { AdminAuthProvider } from "./context/AdminAuthContext";

import Home from "./pages/Home";
import Haircuts from "./pages/Haircuts";
import Barbers from "./pages/Barbers";
import Services from "./pages/Services";
import Booking from "./pages/Booking";
import Payment from "./pages/Payment";
import BookingSuccess from "./pages/BookingSuccess";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminPayments from "./pages/admin/AdminPayments";

export default function App() {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-[#090909] text-[#f4f0e8]">
        <Navbar />

        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/haircuts" element={<Haircuts />} />
            <Route path="/barbers" element={<Barbers />} />

            {/* Public booking flow - deliberately unauthenticated. */}
            <Route path="/booking" element={<Booking />} />
            <Route path="/payment/:bookingId" element={<Payment />} />
            <Route
              path="/booking/success/:bookingId"
              element={<BookingSuccess />}
            />

            {/* Staff only. */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin/payments"
              element={
                <RequireAdmin>
                  <AdminPayments />
                </RequireAdmin>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </AdminAuthProvider>
  );
}
