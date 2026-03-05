import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/format — Format code using Prettier
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { code, language } = req.body;
        if (!code) {
            res.status(400).json({ error: 'Code is required' });
            return;
        }

        const prettier = await import('prettier');

        const parserMap: Record<string, { parser: string; plugins: string[] }> = {
            javascript: { parser: 'babel', plugins: ['prettier/plugins/babel', 'prettier/plugins/estree'] },
            typescript: { parser: 'typescript', plugins: ['prettier/plugins/typescript', 'prettier/plugins/estree'] },
            html: { parser: 'html', plugins: ['prettier/plugins/html'] },
            css: { parser: 'css', plugins: ['prettier/plugins/postcss'] },
            json: { parser: 'json', plugins: ['prettier/plugins/babel', 'prettier/plugins/estree'] },
            markdown: { parser: 'markdown', plugins: ['prettier/plugins/markdown'] },
            yaml: { parser: 'yaml', plugins: ['prettier/plugins/yaml'] },
            graphql: { parser: 'graphql', plugins: ['prettier/plugins/graphql'] },
        };

        const config = parserMap[language] || parserMap.javascript;

        // Load plugins dynamically
        const loadedPlugins = [];
        for (const pluginPath of config.plugins) {
            try {
                const plugin = await import(pluginPath);
                loadedPlugins.push(plugin.default || plugin);
            } catch {
                // Plugin not available — skip
            }
        }

        const formatted = await prettier.format(code, {
            parser: config.parser,
            plugins: loadedPlugins,
            semi: true,
            singleQuote: true,
            tabWidth: 2,
            trailingComma: 'es5',
            printWidth: 100,
        });

        res.json({ formatted });
    } catch (error: any) {
        // If prettier plugin loading fails, return a helpful message
        res.status(422).json({
            error: 'Formatting failed',
            details: error.message || 'Unknown formatting error',
        });
    }
});

export default router;
