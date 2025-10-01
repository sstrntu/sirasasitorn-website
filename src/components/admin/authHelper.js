// Admin Authentication Helper

export const getAuthHeaders = () => {
  const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
  const token = session.access_token;

  if (!token) {
    return null;
  }

  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

export const handleAuthError = () => {
  localStorage.removeItem('admin_session');
  window.location.href = '/admin';
};

export const checkAuth = () => {
  const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
  return !!session.access_token;
};

export const authenticatedFetch = async (url, options = {}) => {
  const headers = getAuthHeaders();
  
  if (!headers) {
    handleAuthError();
    throw new Error('No authentication token');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers
    }
  });

  if (response.status === 401) {
    handleAuthError();
    throw new Error('Unauthorized');
  }

  return response;
};
