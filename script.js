const fs = require('fs');
const glob = require('glob');
const path = require('path');

const files = glob.sync('src/{components/admin,components/vendor,pages}/**/*.tsx');

const buttonRegex = /<([B|b]utton)([^>]*)>(.*?)<\/\1>/gs;

let changedFiles = [];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  let needsButtonImport = false;
  
  content = content.replace(buttonRegex, (match, tag, attrs, innerText) => {
    // Evaluate stripped text
    const textStr = innerText.replace(/<[^>]*>/g, '').trim().toLowerCase();
    
    let targetVariant = null;
    
    const exactTextMatch = (keywords) => keywords.some(k => {
      const regex = new RegExp(`\\b${k}\\b`, 'i');
      return regex.test(textStr);
    });

    if (textStr.includes('excluir') || textStr.includes('remover') || textStr.includes('cancelar contrato')) {
      targetVariant = 'destructive';
    } else if (exactTextMatch(['voltar', 'fechar', 'cancelar'])) {
      targetVariant = 'ghost';
    } else if (textStr.includes('aprovar') || textStr.includes('concluir') || textStr.includes('marcar como pago') || textStr.includes('marcar como conclu')) {
      targetVariant = 'success';
    } else if (exactTextMatch(['pausar', 'pendente', 'revisar'])) {
      targetVariant = 'warning';
    } else if (exactTextMatch(['filtrar', 'exportar', 'importar', 'atualizar'])) {
      targetVariant = 'outline';
    } else if (exactTextMatch(['novo', 'criar', 'adicionar', 'salvar', 'confirmar', 'aplicar']) || textStr.includes('+ novo') || textStr.includes('+ criar') || textStr.includes('+ adicionar')) {
      targetVariant = 'default';
    }

    if (targetVariant) {
      if (tag === 'button') {
        tag = 'Button';
        needsButtonImport = true;
      }
      
      let newAttrs = attrs;
      if (/variant=["'{][^"'}]+["'}]/.test(newAttrs)) {
        if (targetVariant === 'default') {
            // "default" is the default variant, so we could remove it or set it. 
            // the shadcn Button handles variant="default".
            newAttrs = newAttrs.replace(/variant=["'{][^"'}]+["'}]/, `variant="default"`);
        } else {
            newAttrs = newAttrs.replace(/variant=["'{][^"'}]+["'}]/, `variant="${targetVariant}"`);
        }
      } else {
        if (targetVariant !== 'default') {
            newAttrs = ` variant="${targetVariant}"${newAttrs}`;
        }
      }
      
      // Cleanup any duplicate variants that might have happened
      return `<${tag}${newAttrs}>${innerText}</${tag}>`;
    }
    
    return match;
  });

  if (content !== originalContent) {
    if (needsButtonImport || (content.includes('<Button') && !content.includes('import { Button }') && !content.includes('import {Button}'))) {
        const importRegex = /^import .* from .*$/m;
        const match = content.match(importRegex);
        const importStmt = `import { Button } from "@/components/ui/button";\n`;
        if (match && !content.includes('@/components/ui/button')) {
            content = content.replace(importRegex, `${importStmt}${match[0]}`);
        } else if (!content.includes('@/components/ui/button')) {
            content = importStmt + content;
        }
    }
    fs.writeFileSync(file, content, 'utf8');
    changedFiles.push(file);
  }
});

console.log(JSON.stringify(changedFiles, null, 2));