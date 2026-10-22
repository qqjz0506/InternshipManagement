import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { MENU_BY_ROLE } from './menuConfig'
import './Layout.css'

function Sidebar() {
  const { currentUser } = useAuth()
  const menuItems = MENU_BY_ROLE[currentUser?.role] || []

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Quản lý thực tập</div>
      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

export default Sidebar
