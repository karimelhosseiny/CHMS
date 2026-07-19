import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="navbar">
      <div className="navbar-brand">CHMS</div>
      <div className="navbar-links">
        {user.role === 'student' && (
          <>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/catalog">Course Catalog</Link>
          </>
        )}
        {user.role === 'admin' && (
          <>
            <Link to="/admin">Admin</Link>
            <Link to="/admin/schedule-consistency">Schedule Consistency</Link>
          </>
        )}
      </div>
      <div className="navbar-user">
        <span>{user.email} ({user.role})</span>
        <button type="button" onClick={handleLogout}>Log out</button>
      </div>
    </nav>
  );
}
