function handle(res){
    if(!res.ok) throw new Error(res.statusText);
    return res;
}