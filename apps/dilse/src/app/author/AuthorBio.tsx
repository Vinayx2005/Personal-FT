'use client';

import { motion } from 'framer-motion';

export function AuthorParagraph({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.8, delay }}
      className="font-serif text-black text-[20px]"
    >
      {children}
    </motion.p>
  );
}
