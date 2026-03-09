
export interface Project {
  id: string;
  name: string;
  outline: string;
  createdAt: number;
}

const STORAGE_KEY = 'test_gen_projects';

export const projectService = {
  getAll: (): Project[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  save: (project: Omit<Project, 'id' | 'createdAt'> & { id?: string; createdAt?: number }): Project => {
    const projects = projectService.getAll();
    const newProject: Project = {
      id: project.id || Math.random().toString(36).substring(2, 11),
      createdAt: project.createdAt || Date.now(),
      name: project.name,
      outline: project.outline
    };

    const index = projects.findIndex(p => p.id === newProject.id);
    if (index > -1) {
      projects[index] = newProject;
    } else {
      projects.push(newProject);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    return newProject;
  },

  delete: (id: string) => {
    const projects = projectService.getAll().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  },

  getById: (id: string): Project | undefined => {
    return projectService.getAll().find(p => p.id === id);
  }
};
