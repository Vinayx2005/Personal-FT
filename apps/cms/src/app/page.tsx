import AuthGate from './AuthGate';
import Link from 'next/link';
import { PenLine, BookOpen, Users, ArrowRight } from 'lucide-react';

export default function CmsHome() {
  return (
    <AuthGate>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-black text-white mb-6">Content admin</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/blog"
            className="group bg-18-surface border border-18-border rounded-2xl p-5 hover:border-18-orange/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-18-orange/10 border border-18-orange/30 flex items-center justify-center mb-3">
              <PenLine size={18} className="text-18-orange" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-white">Blog</p>
              <ArrowRight size={14} className="text-white/40 group-hover:text-18-orange transition-colors" />
            </div>
            <p className="text-xs text-white/50 mt-1">Root + PFT blog posts</p>
          </Link>
          <Link
            href="/stories"
            className="group bg-18-surface border border-18-border rounded-2xl p-5 hover:border-18-orange/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-18-orange/10 border border-18-orange/30 flex items-center justify-center mb-3">
              <BookOpen size={18} className="text-18-orange" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-white">Dilse</p>
              <ArrowRight size={14} className="text-white/40 group-hover:text-18-orange transition-colors" />
            </div>
            <p className="text-xs text-white/50 mt-1">Stories</p>
          </Link>
          <Link
            href="/users"
            className="group bg-18-surface border border-18-border rounded-2xl p-5 hover:border-18-orange/40 transition-colors"
          >
            <div className="h-10 w-10 rounded-lg bg-18-orange/10 border border-18-orange/30 flex items-center justify-center mb-3">
              <Users size={18} className="text-18-orange" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-base font-bold text-white">Users</p>
              <ArrowRight size={14} className="text-white/40 group-hover:text-18-orange transition-colors" />
            </div>
            <p className="text-xs text-white/50 mt-1">Accounts across all apps</p>
          </Link>
        </div>
      </div>
    </AuthGate>
  );
}
