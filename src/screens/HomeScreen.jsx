import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Generate a pseudo‑random scene identifier using base36 encoding. The
// identifier is used as a Firestore document ID and becomes part of the
// shareable URL.
function generateSceneId() {
  return Math.random().toString(36).substring(2, 12);
}

export default function HomeScreen() {
  const navigate = useNavigate();
  useEffect(() => {
    const id = generateSceneId();
    navigate(`/canvas/${id}`, { replace: true });
  }, [navigate]);
  return null;
}