import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ErrorBoundary from '../../components/ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renderiza children normalmente (regressao: render retornava this.children undefined e matava o boot)', () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <div>child-montado</div>
      </ErrorBoundary>
    );
    expect(html).toContain('child-montado');
  });

  it('renderiza fallback visivel quando ha erro no state', () => {
    const instance = Object.create(ErrorBoundary.prototype) as ErrorBoundary;
    instance.state = { error: new Error('boom-test') };
    instance.props = { children: null };
    const html = renderToStaticMarkup(instance.render());
    expect(html).toContain('Algo deu errado');
    expect(html).toContain('boom-test');
  });
});
