function sendForm(url, formName, method='POST'){
    var form = formName ? document[formName] : document.forms[0];
    if(!form) throw new Error('NO FORM FOUND');
    var body = JSON.stringify(Array.from(form).filter(el => el.name).reduce((obj, el) => {
        obj[el.name] = el.value;
        return obj;
    },{}));
    return fetch(url,{
        method,
        body,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    }).then(res => {
        if(!res.ok) throw new Error(res.statusText);
        return res;
    })
}