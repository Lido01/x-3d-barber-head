import { Route, Routes, useLocation } from "react-router-dom";

import Navbar from "./components/Navbar";
import BottomBar from "./components/BottomBar";
import Footer from "./components/Footer";
import RequireAdmin from "./components/RequireAdmin";
import RequireCustomer from "./components/RequireCustomer";
import ScrollToTop from "./components/ScrollToTop";
import AdminLayout from "./components/admin/AdminLayout";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { LanguageProvider } from "./i18n/LanguageContext";

import Home from "./pages/Home";
import Gallery from "./pages/Gallery";
import Haircuts from "./pages/Haircuts";
import Barbers from "./pages/Barbers";
import Services from "./pages/Services";
import ServiceDetail from "./pages/ServiceDetail";
import Booking from "./pages/Booking";
import Payment from "./pages/Payment";
import BookingSuccess from "./pages/BookingSuccess";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminServices from "./pages/admin/AdminServices";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminTestimonials from "./pages/admin/AdminTestimonials";

/**
 * Staff-only screen chunk. Each admin route is wrapped in RequireAdmin
 * and rendered inside the shared sidebar layout.
 */
function AdminScreen({ children }) {
  return (
    <RequireAdmin>
      <AdminLayout>{children}</AdminLayout>
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AdminAuthProvider>
        <CustomerAuthProvider>
          <Shell />
        </CustomerAuthProvider>
      </AdminAuthProvider>
    </LanguageProvider>
  );
}

/** Screens that own their whole viewport, chrome included. */
const BARE_PATHS = ["/admin", "/login", "/register", "/account"];

function isBare(pathname) {
  return BARE_PATHS.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );
}

/** Renders the public nav/footer, then the routed content. */
function Shell() {
  const location = useLocation();
  const bare = isBare(location.pathname);

  return (
    <div className="min-h-screen bg-[#090909] text-[#f4f0e8]">
      <ScrollToTop />

      {!bare && <Navbar />}

      <main
        id="main-content"
        tabIndex={-1}
        className="outline-none lg:pb-0"
      >
        <Routes>
          {/* Public site */}
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/services/:id" element={<ServiceDetail />} />
          <Route path="/haircuts" element={<Haircuts />} />
          <Route path="/barbers" element={<Barbers />} />
          <Route path="/gallery" element={<Gallery />} />

          {/* Public booking flow - deliberately unauthenticated. */}
          <Route path="/booking" element={<Booking />} />
          <Route path="/payment/:bookingId" element={<Payment />} />
          <Route
            path="/booking/success/:bookingId"
            element={<BookingSuccess />}
          />

          {/* Customer account. Needed to leave a review, not to book. */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/account"
            element={
              <RequireCustomer>
                <Account />
              </RequireCustomer>
            }
          />

          {/* Staff only. */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminScreen><AdminOverview /></AdminScreen>} />
          <Route
            path="/admin/bookings"
            element={<AdminScreen><AdminBookings /></AdminScreen>}
          />
          <Route
            path="/admin/payments"
            element={<AdminScreen><AdminPayments /></AdminScreen>}
          />
          <Route
            path="/admin/services"
            element={<AdminScreen><AdminServices /></AdminScreen>}
          />
          <Route
            path="/admin/gallery"
            element={<AdminScreen><AdminGallery /></AdminScreen>}
          />
          <Route
            path="/admin/testimonials"
            element={<AdminScreen><AdminTestimonials /></AdminScreen>}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!bare && <Footer />}
      {!bare && <BottomBar />}
    </div>
  );
}
