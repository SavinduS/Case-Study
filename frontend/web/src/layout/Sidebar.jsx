import { NavLink } from 'react-router-dom';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">Serengeti Portal</div>
      <div style={{fontSize:12,opacity:.7}}>OPERATIONS</div>
      <nav>
        <NavLink to="/analytics/type">Generate report</NavLink>
        <NavLink to="/analytics/saved">Saved reports</NavLink>
        <NavLink to="/analytics/criteria">Zone settings</NavLink>
      </nav>
      <div className="card" style={{background:'#1d4a38',color:'#fff'}}>Data sync healthy<br/><small>Incident and patrol logs synced</small></div>
    </aside>
  );
}
