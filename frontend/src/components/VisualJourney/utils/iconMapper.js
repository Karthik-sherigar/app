// Icon mapper for different node types
import { Lightbulb, Key, Rocket, Settings, Code, FileText, Zap, Lock } from 'lucide-react';

export const getIconForType = (type) => {
    const iconMap = {
        Concept: Lightbulb,
        Prerequisite: Key,
        Application: Rocket,
        Component: Settings,
        CodeBlock: Code,
        DocumentSection: FileText,
    };

    return iconMap[type] || Zap;
};

export const getEmojiForType = (type) => {
    const emojiMap = {
        Concept: '💡',
        Prerequisite: '🔑',
        Application: '🚀',
        Component: '⚙️',
        CodeBlock: '💻',
        DocumentSection: '📄',
    };

    return emojiMap[type] || '📌';
};

export const getGradientForType = (type) => {
    const gradients = {
        Concept: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        Prerequisite: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 100%)',
        Application: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
        Component: 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)',
        CodeBlock: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
        DocumentSection: 'linear-gradient(135deg, #a855f7 0%, #d946ef 100%)',
    };

    return gradients[type] || 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
};
