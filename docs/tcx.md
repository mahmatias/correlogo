# Documentação do Scraper via API - Supermercado Mundial

## 1. Introdução
Este documento descreve como configurar e utilizar o novo scraper para o Supermercado Mundial, que substitui a abordagem de parsing HTML (via Cheerio) pelo consumo direto da API JSON utilizada pelo site. Esta mudança traz maior performance, confiabilidade e facilidade de manutenção.

O scraper acessa o endpoint `/_next/data/<hash>/departamentos/categoria/ofertas.json` para obter as ofertas em formato estruturado, processando todas as páginas disponíveis e exportando os dados em JSON.

---

## 2. Pré‑requisitos
- Node.js v18 ou superior.
- Pacotes instalados no projeto: `axios` e `tsx` (para execução TypeScript). Opcionalmente `typescript` e `ts-node`.

Caso não os tenha, instale com:
```bash
npm install axios tsx
```
---

## 3. Criação do arquivo do scraper
Crie um novo arquivo em `src/scrapers/mundial-api-scraper.ts` com o conteúdo abaixo.

```ts
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const URL = 'https://supermercadosmundial.com.br/_next/data/9e6AzvDIVu5KiID0-ktov/departamentos/categoria/ofertas.json';

function limparPreco(texto: string): number {
  if (!texto) return 0;
  const limpo = texto.replace(/R\$\s*/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(limpo) || 0;
}

async function buscarOfertas(pagina: number) {
  const resposta = await axios.get(URL, {
    params: { page: pagina, slug: 'ofertas' },
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const dados = resposta.data;
  const ofertas = dados.pageProps?.offers || [];
  return ofertas.map((item: any) => {
    const produto = item.product || {};
    const nome = produto.customName || 'Nome desconhecido';
    const precoRegular = limparPreco(item.oldPrice);
    const precoOferta = limparPreco(item.price);
    const desconto = item.percent || 
                     (precoRegular > 0 ? Math.round(((precoRegular - precoOferta) / precoRegular) * 100) : 0);
    return {
      nome,
      marca: produto.customBrand || '',
      precoRegular,
      precoOferta: precoOferta !== precoRegular ? precoOferta : undefined,
      unidade: item.measureUnit || produto.customWeight || 'un',
      categoria: item.category?.name || 'Geral',
      desconto
    };
  });
}
export async function scraperMundialApi() {
  console.log('🛒 Buscando ofertas via API...');
  const primeiraPagina = await axios.get(URL, {
    params: { page: 1, slug: 'ofertas' },
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const totalPaginas = primeiraPagina.data.pageProps?.numberOfPages || 1;
  console.log(`📄 Total de páginas: ${totalPaginas}`);
  let todosProdutos = [];
  for (let pagina = 1; pagina <= totalPaginas; pagina++) {
    console.log(`📄 Buscando página ${pagina}/${totalPaginas}...`);
    const produtos = await buscarOfertas(pagina);
    todosProdutos = todosProdutos.concat(produtos);
    console.log(`   ✅ ${produtos.length} produtos (acumulado: ${todosProdutos.length})`);
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  console.log(`\n✅ Total de produtos coletados: ${todosProdutos.length}`);
  return todosProdutos;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const produtos = await scraperMundialApi();
    const pastaOutput = path.join(process.cwd(), 'output');
    if (!fs.existsSync(pastaOutput)) fs.mkdirSync(pastaOutput);
    const caminhoArquivo = path.join(pastaOutput, 'ofertas-completas.json');
    fs.writeFileSync(caminhoArquivo, JSON.stringify(produtos, null, 2));
    console.log(`💾 Dados salvos em: ${caminhoArquivo}`);
    console.log('\n📦 Exemplo dos primeiros 5 produtos:');
    produtos.slice(0, 5).forEach((p, i) => {
      const precoAtual = p.precoOferta || p.precoRegular;
      console.log(`${i+1}. ${p.nome}`);
      console.log(`   Marca: ${p.marca || 'N/A'}`);
      console.log(`   Preço: R$ ${precoAtual.toFixed(2)} (antes R$ ${p.precoRegular.toFixed(2)})`);
      console.log(`   Desconto: ${p.desconto}%`);
      console.log(`   Unidade: ${p.unidade}`);
      console.log(`   Categoria: ${p.categoria}`);
      console.log('---');
    });
  })();
}
```

## 4. Execução
### 4.1 Execução direta (gera arquivo JSON)
Execute o comando abaixo no terminal:

```bash
npx tsx src/scrapers/mundial-api-scraper.ts
```

O script irá varrer todas as páginas disponíveis, salvar o resultado em `output/ofertas-completas.json` e exibir um resumo no terminal.

### 4.2 Uso programático (dentro de outro código)
Importe a função `scraperMundialApi` e utilize-a:

```ts
import { scraperMundialApi } from './scrapers/mundial-api-scraper';
const produtos = await scraperMundialApi();
console.log(produtos.length);
```

---

## 5. Estrutura dos dados retornados
O scraper retorna um array de objetos com os seguintes campos:

| Campo           | Tipo    | Descrição |
|-----------------|---------|-----------|
| `nome`          | string  | Nome do produto (campo `customName` da API). |
| `marca`         | string  | Marca do produto (campo `customBrand`). |
| `precoRegular`  | number  | Preço original (campo `oldPrice`). |
| `precoOferta`   | number? | Preço com desconto (campo `price`), `undefined` se igual ao regular. |
| `unidade`       | string  | Unidade de medida (ex: `UN`, `KG`, `L`). |
| `categoria`     | string  | Nome da categoria (ex: `Encarte`, `Açougue`). |
| `desconto`      | number  | Percentual de desconto (calculado ou vindo do campo `percent`). |

Exemplo de um item:
```json
{
  "nome": "Vinho Tinto",
  "marca": "FAUSTINO I GRAN RESERVA",
  "precoRegular": 258.00,
  "precoOferta": 235.00,
  "unidade": "UN",
  "categoria": "Encarte",
  "desconto": 9
}
```
## 6. Atualização do hash (se necessário)
A URL contém um hash (`9e6AzvDIVu5KiID0-ktov`) que pode mudar quando o site é atualizado. Caso o scraper pare de funcionar:

1. Acesse https://supermercadosmundial.com.br/departamentos/categoria/ofertas no navegador.
2. Abra as ferramentas de desenvolvedor (F12), aba Network.
3. Recarregue a página e procure uma requisição para `ofertas.json`.
4. Copie o caminho completo – o hash estará no meio da URL.
5. Substitua o valor da constante `URL` no script.

---

## 7. Integração com o sistema existente
Se seu sistema já possui outros scrapers (como o `mundial-scraper.ts` baseado em Cheerio), você pode substituí-lo completamente pelo novo ou mantê-lo como fallback, caso a API mude. A função `scraperMundialApi` é compatível com a interface anterior (retorna `Produto[]`), facilitando a substituição.

---

## 8. Considerações finais
- O novo scraper é mais rápido e menos sujeito a quebras por alterações visuais.
- O arquivo JSON gerado pode ser usado para análises, alimentação de banco de dados ou integração com sistemas externos.
- Em caso de dúvidas, consulte o arquivo original `mundial-scraper.ts` para comparação.
