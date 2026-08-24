/**
 * Icons.
 *
 * Badges and quests name an icon as a string (lib/domain/derived.ts), so there
 * has to be a name -> component map somewhere. This is it. An unknown name
 * falls back to a neutral mark rather than rendering nothing, because a badge
 * with no icon looks like a bug.
 *
 * Deliberately not emoji: emoji render differently on every platform, cannot be
 * recoloured, and read as filler.
 *
 * Only the names in use are listed. Adding a badge means adding its icon here.
 */

import {
    Award,
    Check,
    ClipboardCheck,
    Flag,
    FlagTriangleRight,
    Flame,
    Layers,
    Lock,
    Map,
    Target,
    TrendingUp,
    Zap,
    type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
    award: Award,
    check: Check,
    'clipboard-check': ClipboardCheck,
    flag: Flag,
    'flag-triangle-right': FlagTriangleRight,
    flame: Flame,
    layers: Layers,
    lock: Lock,
    map: Map,
    target: Target,
    'trending-up': TrendingUp,
    zap: Zap,
};

interface IconProps {
    name: string;
    size?: number;
    className?: string;
}

export function Icon({ name, size = 16, className }: IconProps) {
    const Component = ICONS[name] ?? Award;
    return <Component size={size} strokeWidth={1.75} className={className} aria-hidden="true" />;
}
