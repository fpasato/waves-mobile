// hooks/useBottomSheetDrag.js
import { useRef, useState, useEffect } from 'react';

export function useBottomSheetDrag({ open, onOpenChange, closeThreshold = 120 }) {
  const startY = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  const handleDragStart = (e) => {
    if (!open) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startY.current = clientY;
    setIsDragging(true);
    setDragOffset(0);
  };

  const handleDragMove = (e) => {
    if (!isDragging || !open) return;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    let delta = clientY - startY.current;
    if (delta < 0) delta = 0; // só para baixo
    setDragOffset(delta);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    if (dragOffset > closeThreshold) {
      onOpenChange(false);
    }
    setIsDragging(false);
    setDragOffset(0);
  };

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, dragOffset]);

  const getTransform = () => {
    if (!open) return 'translateX(-50%) translateY(88%)';
    return `translateX(-50%) translateY(${dragOffset}px)`;
  };

  const transition = isDragging ? 'none' : 'transform 0.35s ease';

  return {
    handleDragStart,
    getTransform,
    transition,
    isDragging,
  };
}