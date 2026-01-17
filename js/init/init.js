app.ready(()=>{
    window.TL = new tmplink();
    TL.ready(()=>{
        //移除所有的modal
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
        TL.language(app.languageSetting);
    });
});

$('.tooltip').tooltipster({
    theme: 'tooltipster-noir'
});
