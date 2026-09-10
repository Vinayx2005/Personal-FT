'use client';

import { motion } from 'framer-motion';

export function HeroInner({ heading, sub }: { heading: string; sub?: string }) {
  return (
    <div className="relative z-10 container mx-auto px-6 sm:px-[50px] pb-16 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="max-w-3xl text-white"
      >
        <h1 className="font-serif text-4xl md:text-6xl font-bold leading-tight tracking-tight">
          {heading}
        </h1>
        {sub && <p className="mt-6 text-lg md:text-xl text-white/90 leading-relaxed max-w-2xl whitespace-normal md:whitespace-pre-line">{sub}</p>}
      </motion.div>
    </div>
  );
}
