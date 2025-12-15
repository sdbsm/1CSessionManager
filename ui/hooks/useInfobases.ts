import { useState, useEffect } from 'react';
import { apiFetchJson } from '../services/apiClient';

export interface Infobase {
  name: string;
  uuid: string;
}

export function useInfobases() {
  const [availableDbs, setAvailableDbs] = useState<Infobase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDatabases = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetchJson<Infobase[]>('/api/infobases');
      if (Array.isArray(data)) {
        setAvailableDbs(data);
      } else {
        setAvailableDbs([]);
      }
    } catch (err) {
      console.error("Failed to load DBs", err);
      setError("Failed to load DBs");
      setAvailableDbs([]); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatabases();
  }, []);

  return { availableDbs, loading, error, fetchDatabases };
}
