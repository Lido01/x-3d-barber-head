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
import { ThemeProvider } from "./context/ThemeContext";
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
import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

import AdminLogin from "./pages/admin/AdminLogin";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminPayments from "./pages/admin/AdminPayments";
import AdminServices from "./pages/admin/AdminServices";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminTeam from "./pages/admin/AdminTeam";
import AdminAuditLog from "./pages/admin/AdminAuditLog";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";

/**
 * Staff-only screen chunk. Each admin route is wrapped in RequireAdmin
 * and rendered inside the shared sidebar layout.
 *
 * `capability` and `peopleOnly` mirror the two gates in adminNav, so a
 * typed URL and a nav link agree on whether a screen is reachable.
 * They are declared per route rather than looked up from the nav
 * because this is the only place that knows which screen is which -
 * duplicating that mapping is what lets the two drift apart.
 */
function AdminScreen({ children, capability, peopleOnly = false }) {
  return (
    <RequireAdmin capability={capability} peopleOnly={peopleOnly}>
      <AdminLayout>{children}</AdminLayout>
    </RequireAdmin>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      {/* Outside the auth providers on purpose: the theme is a device
          preference, and the sign-in screen is the one screen that has
          to render correctly before anyone is signed in. */}
      <ThemeProvider>
        <AdminAuthProvider>
          <CustomerAuthProvider>
            <Shell />
          </CustomerAuthProvider>
        </AdminAuthProvider>
      </ThemeProvider>
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
          <Route path="/help" element={<Help />} />

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

          {/* Staff only. The overview has no capability of its own -
              the endpoint scopes itself to what the caller may see. */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminScreen><AdminOverview /></AdminScreen>} />
          <Route path="/admin/dashboard/:role" element={<AdminScreen><AdminOverview /></AdminScreen>} />
          <Route
            path="/admin/bookings"
            element={<AdminScreen capability="bookings.view"><AdminBookings /></AdminScreen>}
          />
          <Route
            path="/admin/customers"
            element={<AdminScreen capability="customers.view"><AdminCustomers /></AdminScreen>}
          />

          {/* The screens that hand out power. Gated on role, not
              capability - see RequireAdmin. */}
          <Route
            path="/admin/team"
            element={<AdminScreen peopleOnly><AdminTeam /></AdminScreen>}
          />
          <Route
            path="/admin/activity"
            element={<AdminScreen peopleOnly><AdminAuditLog /></AdminScreen>}
          />
          <Route
            path="/admin/users"
            element={<AdminScreen peopleOnly><AdminUsers /></AdminScreen>}
          />
          <Route
            path="/admin/payments"
            element={<AdminScreen capability="payments.view"><AdminPayments /></AdminScreen>}
          />
          <Route
            path="/admin/services"
            element={<AdminScreen capability="services.manage"><AdminServices /></AdminScreen>}
          />
          <Route
            path="/admin/gallery"
            element={<AdminScreen capability="gallery.manage"><AdminGallery /></AdminScreen>}
          />
          <Route
            path="/admin/testimonials"
            element={<AdminScreen capability="reviews.moderate"><AdminTestimonials /></AdminScreen>}
          />

          {/* Shop settings. No capability gate on the screen itself:
              reading the shop's own details is not privileged - a
              receptionist reading out the address needs the same record
              an owner edits. The endpoint decides who may write, and
              the screen renders its controls accordingly. */}
          <Route
            path="/admin/settings"
            element={<AdminScreen><AdminSettings /></AdminScreen>}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {!bare && <Footer />}
      {!bare && <BottomBar />}
    </div>
  );
}
