import { Link } from 'react-router-dom';
import ModulePlaceholder from '../components/ui/ModulePlaceholder.jsx';

const OWNERS = {
  'data-logs': {
    title: 'Data Logs',
    owner: 'Shared platform module',
    useCaseName: 'Feeds all four use cases',
    description:
      'Raw ingestion and activity logs for SMS conflict reports, offline field incidents, patrol records and collar telemetry.'
  },
  'map-view': {
    title: 'Map View',
    owner: 'Shared platform module',
    useCaseName: 'Feeds all four use cases',
    description:
      'The park-wide map. The Collar Boundary Alerts dashboard already carries its own full-bleed map with geofences, tracked collars and ranger positions.'
  },
  reports: {
    title: 'Reports',
    owner: 'Wijesingha S M (IT23538214)',
    useCaseName: 'Park Management and Patrol Analytics Reports',
    description:
      'Statistical reporting on incidents by type and location over time, patrol coverage across the park, and human-wildlife conflict trends for funding bodies.'
  },
  admin: {
    title: 'Admin',
    owner: 'Shared platform module',
    useCaseName: 'Administration',
    description:
      'User accounts and park configuration. Note that the assignment brief excludes login, logout and privilege granting from grading.'
  }
};

/** Portal routes that are owned by another use case in the group design. */
export default function PortalModuleRoute({ moduleKey }) {
  const owner = OWNERS[moduleKey];
  if (!owner) return null;

  return (
    <div className="h-full">
      <ModulePlaceholder {...owner} />
    </div>
  );
}