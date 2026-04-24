import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { MOTION_TRANSITION } from '../../lib/motion';

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={MOTION_TRANSITION}
    >
      {children}
    </motion.div>
  );
}
