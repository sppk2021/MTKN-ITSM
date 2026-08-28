import React, { useState } from 'react';
import { ITProject } from './types';
import PortfolioView from './PortfolioView';
import ProjectDetailView from './ProjectDetailView';

interface ClientProjectsProps {
  userRole?: string;
  userPermissions?: any;
}

export default function ITProjectsManager({ userRole, userPermissions }: ClientProjectsProps) {
  const [selectedProject, setSelectedProject] = useState<ITProject | null>(null);

  if (selectedProject) {
    return (
      <ProjectDetailView 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)} 
      />
    );
  }

  return (
    <PortfolioView 
      onSelectProject={setSelectedProject} 
    />
  );
}
