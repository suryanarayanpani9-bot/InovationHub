const bars = document.querySelector('.bars');
const menu = document.querySelector('.menu');
const menuLinks = document.querySelectorAll('.menu a');
const sections = document.querySelectorAll('.content-section');
const details = document.querySelector('#details');

function closeMenu() {
    menu.classList.remove('active');
}

bars.addEventListener('click', () => {
    menu.classList.toggle('active');
});

menuLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
        const targetId = link.getAttribute('data-target');
        if (!targetId) return;
        event.preventDefault();

        if (targetId === 'home') {
            sections.forEach((section) => section.classList.remove('active'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            sections.forEach((section) => {
                section.classList.toggle('active', section.id === targetId);
            });
            details.scrollIntoView({ behavior: 'smooth' });
        }

        closeMenu();
    });
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeMenu();
    }
});
