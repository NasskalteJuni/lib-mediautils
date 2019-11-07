Tunnel.onImport('multiply', numbers => {
    console.log('onImport called for multiply with', numbers);
    const product = numbers.length === 0 ? 0 : numbers.reduce((product, n) => n * product, 1);
    Tunnel.doExport('product', product);
});