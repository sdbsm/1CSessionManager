import React from 'react';
import { Badge } from '../ui/Badge';

interface SeverityBadgeProps {
  level: 'info' | 'warning' | 'critical';
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ level }) => {
  const variantMap = {
    info: 'info',
    warning: 'warning',
    critical: 'danger'
  } as const;

  const label = level === 'critical' ? 'CRITICAL' : level === 'warning' ? 'WARNING' : 'INFO';

  return (
    <Badge variant={variantMap[level]} size="sm">
      {label}
    </Badge>
  );
};
