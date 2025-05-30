let currentSlide = 0;
const slides = document.querySelectorAll("#carousel img");

function moveSlide(direction) {
  currentSlide += direction;
  if (currentSlide < 0) currentSlide = slides.length - 1;
  if (currentSlide >= slides.length) currentSlide = 0;
  document.getElementById("carousel").style.transform = `translateX(-${currentSlide * 100}%)`;
}

// Implementação de scroll suave para os links de navegação
document.addEventListener('DOMContentLoaded', function() {
  // Seleciona todos os links que apontam para âncoras na página
  const navLinks = document.querySelectorAll('nav a[href^="#"]');
  
  // Adiciona evento de clique a cada link
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault(); // Previne o comportamento padrão do link
      
      // Obtém o alvo da âncora a partir do atributo href
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        // Realiza o scroll suave até o elemento
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
});
