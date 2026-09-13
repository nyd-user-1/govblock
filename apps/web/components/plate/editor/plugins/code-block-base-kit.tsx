import {
  BaseCodeBlockPlugin,
  BaseCodeLinePlugin,
  BaseCodeSyntaxPlugin,
} from '@platejs/code-block';

import {
  CodeBlockElementStatic,
  CodeLineElementStatic,
  CodeSyntaxLeafStatic,
} from '@/components/plate/ui/code-block-node-static';

import { currentLowlight, loadLowlight } from './lowlight';

// Static editors (export, previews) read the grammars when they are built. The
// first one built starts the load; on the server it starts with the module.
if (typeof window === 'undefined') void loadLowlight();

export const BaseCodeBlockKit = [
  BaseCodeBlockPlugin.configure(() => {
    void loadLowlight();

    return {
      node: { component: CodeBlockElementStatic },
      options: { lowlight: currentLowlight() },
    };
  }),
  BaseCodeLinePlugin.withComponent(CodeLineElementStatic),
  BaseCodeSyntaxPlugin.withComponent(CodeSyntaxLeafStatic),
];
