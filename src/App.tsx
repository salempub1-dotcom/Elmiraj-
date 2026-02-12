import React, { useState, useEffect } from 'react'; // Ensure React is imported
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Categories from './components/Categories';
import FeaturedProducts from './components/FeaturedProducts';
import Contact from './components/Contact';
import Footer from './components/Footer';
import AdminDashboard from './components/admin/AdminDashboard';
import './App.css';

// A simple component to render the main website layout
const MainSite = () => (
  <div className="App">
    <Navbar />
    <Hero />
    <Categories />
    <FeaturedProducts />
    <Contact />
    <Footer />
  </div>
);

function App() {
  const [isAdminView, setIsAdminView] = useState(false);

  useEffect(() => {
    const checkHash = () => {
      // Check if the hash is exactly '#admin'
      if (window.location.hash === '#admin') {
        setIsAdminView(true);
      } else {
        setIsAdminView(false);
      }
    };

    // Check the hash on initial load
    checkHash();

    // Add event listener for hash changes
    window.addEventListener('hashchange', checkHash, false);

    // Cleanup listener on component unmount
    return () => {
      window.removeEventListener('hashchange', checkHash, false);
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // Conditionally render the Admin Dashboard or the Main Site
  return isAdminView ? <AdminDashboard /> : <MainSite />;
}

export default App;
