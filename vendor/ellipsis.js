/**
 * Method to clip the content of the element
 * Doesn't work with inline elements
 * 
 * @param {string} selector - a CSS selector for the element that needed to be clipped 
 * @param {number} lines - number of lines that need to left
 */
function ellipsizeTextBox(selector, lines) {
   var lineHeight = 1.2; // Default line height in em
   var el = document.querySelectorAll(selector);
   var elHeight = (lineHeight * lines) + lineHeight; // Add one more line height so that we clip text right
   var inlineTags = ['b', 'big', 'i', 'small', 'tt', 'abbr', 'acronym', 'cite', 'code', 'dfn', 'em', 'kbd', 'strong', 'samp', 'var', 'a', 'bdo', 'br', 'img', 'map', 'object', 'q', 'script', 'span', 'sub', 'sup', 'button', 'input', 'label', 'select', 'textarea', 'h1', 'h2', 'h3', 'h4', 'h5'];

   if (el.length === 0) {
      console.error('There is no elements on the page with this "' + selector + '" selector. Please check the selector.');
      return
   }

   for (var i = 0; i < el.length; i++) {
      var isInline = _.indexOf(inlineTags, el[i].tagName.toLowerCase());

      if (isInline > -1) {
         console.error('Please, do not use ellipsizeTextBox function on inline elements it may cause an infinite loop and block your app.',
            'You have used it on <' + el[i].tagName.toLowerCase() + '> tag which was found by this "' + selector + '" selector');
         break;
      }

      el[i].style.height = elHeight + 'em'; // Set element height according to the number of lines we want to left

      var wordArray = el[i].innerHTML.split(' ');

      while (el[i].scrollHeight > el[i].offsetHeight) {
         wordArray.pop(); // We will remove last word untill scroll height want be equal to offset height
         el[i].innerHTML = wordArray.join(' ') + '...';
      }

      el[i].removeAttribute('style'); // Remove style attribute so the height of the element will return to auto
   }
}