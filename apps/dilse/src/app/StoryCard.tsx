'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

interface Props {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
}

export function StoryCard({ slug, title, excerpt, date, readTime }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="group cursor-pointer flex flex-col gap-3 mt-4"
    >
      <Link href={`/story/${slug}`}>
        <h3 className="font-serif text-2xl font-semibold leading-tight">{title}</h3>
        <div className="flex items-center gap-4 text-sm text-gray-500 uppercase tracking-widest mt-3">
          {date && <span>{date}</span>}
          {date && readTime && <span>•</span>}
          {readTime && <span>{readTime}</span>}
        </div>
        <p className="text-gray-600 line-clamp-3 leading-relaxed mt-4">{excerpt}</p>
      </Link>
    </motion.div>
  );
}
