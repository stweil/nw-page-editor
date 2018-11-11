/**
 * Interactive editing of Page XMLs functionality.
 *
 * @version $Version: 2018.11.11$
 * @author Mauricio Villegas <mauricio_ville@yahoo.com>
 * @copyright Copyright(c) 2015-present, Mauricio Villegas <mauricio_ville@yahoo.com>
 * @license MIT License
 */

/* @todo Capture tabs when modals open */

$(window).on('load', function () {

  /// Create PageCanvas instance ///
  var pageCanvas = window.pageCanvas = new window.PageCanvas( 'xpg',
    { stylesId: 'page_styles',
      textareaId: 'textedit',
      handleError: function ( err ) { alert(err.message+"\n"+err.stack); throw err; },
      handleWarning: function ( msg ) { console.log('WARNING: '+msg); alert('WARNING: '+msg); },
      onLoad: function () {
          //$('#imageBase').text(pageCanvas.util.imgBase);
          handleEditMode();
          window.setTimeout( function () { setPropertyTag(); }, 100 );
          if ( pageCanvas.cfg.modeFilter === '.xpath-select' )
            filterMode();
        },
      onMouseMove: updateCursor,
      onUnload: function () { $('#stateInfo span').text('-'); },
      onSelect: function ( elem ) {
          var
          g = $(elem).closest('g'),
          editable = pageCanvas.util.getSortedEditables(),
          text = g.find('> .TextEquiv');
          $('#selectedType').text( g.hasClass('TableCell') ? 'TableCell' : g.attr('class').replace(/ .*/,'') );
          $('#selectedId').text( g.is('.Page') && ! g.attr('id') ? $('.Page').index(g)+1 : g.attr('id') );
          $('#modeElement').text((editable.index(g)+1)+'/'+editable.length);

          updateSelectedInfo();

          if ( text.length !== 0 ) {
            text = pageCanvas.cfg.textFormatter(text.html());
            $('#textedit').val(text);
          }
          else
            $('#textedit').val('');

          $('[class*=selected-parent-]').removeClass( function (index, className) {
              return (className.match(/(^|\s)selected-parent-\S+/g) || []).join(' ');
            } );
          g.closest('.Word').addClass('selected-parent-word');
          g.closest('.TextLine').addClass('selected-parent-line');
          g.closest('.TextRegion').addClass('selected-parent-region');
          g.closest('.Page').addClass('selected-parent-page');

          setPropertyTag(g);

          if ( prop_modal.hasClass('modal-active') )
            populatePropertyModal(g);
        },
      onPointsChangeEnd: function ( elem ) {
          if ( $(elem).closest('g').is('.TextLine') )
            updateSelectedInfo();
        },
      onFinishCoords: editModeAfterCreate,
      onFinishBaseline: editModeAfterCreate,
      onFinishTable: editModeAfterCreate,
      onEscOverride: function () {
          if ( prop_modal.is('.modal-active') ) {
            closePropModal();
            return false;
          }
          else if ( $('#readme-modal').is('.modal-active') ) {
            $('#readme-modal').removeClass('modal-active');
            return false;
          }
          else if ( window.getComputedStyle($('#drawer')[0]).display !== 'none' ) {
            $('#drawerButton').click();
            return false;
          }
          return true;
        },
      onNoEditEsc: function () {
          $('[class*=selected-parent-]').removeClass( function (index, className) {
              return (className.match(/(^|\s)selected-parent-\S+/g) || []).join(' ');
            } );
        },
      onUnselect: function () {
          $('#selectedType').text('-');
          $('#selectedId').text('-');
          $('#modeElement').text('-/'+$('.editable').length);
          $('#textedit').val('');
          $('#textinfo').empty();
          setPropertyTag();
        },
      onDragStart: function () {
          $('#container').addClass('hide-prop-tag');
        },
      onDragEnd: function () {
          if ( $('#hide-prop-tag > input').prop('checked') )
            $('#container').removeClass('hide-prop-tag');
        },
      onClone: function ( clone ) {
          clone
            .find('[class*=selected-parent-]')
            .removeClass( function (index, className) {
                return (className.match(/(^|\s)selected-parent-\S+/g) || []).join(' ');
              } );
          clone
            .find('.xpath-select')
            .removeClass('xpath-select');
        },
      /*onCloneInternal: function ( clone ) {
          clone
            .find('.highlight')
            .removeClass('highlight');
        },*/
      delConfirm: function ( elem ) {
          var
          id = $(elem).attr('id'),
          type = $(elem).attr('class').replace(/ .*/,'')+' '+id;
          if ( elem.length > 1 ) {
            var parent = $(elem).parent();
            if ( parent.length === 1 && $(elem).parent().hasClass('Page') )
              type = elem.length+' child elements from Page '+($('.Page').index(parent)+1);
            else if ( parent.length === 1 && $(elem).parent().hasClass('TableCell') )
              type = elem.length+' child elements from TableCell '+parent.attr('id');
            else
              type = elem.length+' elements with IDs: '+elem.map(function(){return this.id;}).get().join(', ');
          }
          return confirm('WARNING: You are about to remove '+type+'. Continue?');
        },
      delRowColConfirm: function ( id, row, col ) {
          var type = row ? 'row '+row : 'column '+col;
          return confirm('WARNING: You are about to remove '+type+' from TableRegion '+id+'. Continue?');
        },
      onValidText: function () { $('#textedit').removeClass('field-invalid'); },
      onInvalidText: function () { $('#textedit').addClass('field-invalid'); },
      onInvalidTextUnselect: function ( err ) { alert('Invalid XML text: '+err.message); },
      allowPointsChange: confirmCoordsChange,
      allowRemovePolyPoint: confirmCoordsChange,
      allowAddPolyPoint: confirmCoordsChange
    } );

  /// Display info about selected element ///
  function updateSelectedInfo() {
    var
    elem = $('.selected').closest('g'),
    orie = pageCanvas.util.getBaselineOrientation(elem),
    textconf = pageCanvas.util.getTextConf(elem),
    coordsconf = pageCanvas.util.getCoordsConf(elem),
    baselineconf = pageCanvas.util.getBaselineConf(elem),
    props = pageCanvas.util.getProperties(elem),
    readdir = pageCanvas.util.getReadingDirection(),
    info = readdir !== 'ltf' ? '' : '<div>Read direction: '+pageCanvas.util.getReadingDirection()+'</div>';
    if ( typeof orie !== 'undefined' ) {
      info += '<div>Baseline orientation: '+((orie*180/Math.PI).toFixed(1))+'°</div>';
    }
    if ( textconf )
      info += '<div>Text confidence: '+textconf+'</div>';
    if ( coordsconf )
      info += '<div>Coords confidence: '+coordsconf+'</div>';
    if ( baselineconf )
      info += '<div>Baseline confidence: '+baselineconf+'</div>';
    if ( Object.keys(props).length ) {
      info += '<div>Properties:</div>';
      for ( var k in props )
        info += '<div>&nbsp;&nbsp;'+k+(props[k]?'&nbsp;&nbsp;=>&nbsp;&nbsp;'+props[k]:'')+'</div>';
    }
    elem.parents('g').each( function() {
        var props = pageCanvas.util.getProperties(this);
        if ( Object.keys(props).length ) {
          info += '<div>Properties of ancestor '+$(this).attr('class').replace(/ .*/,'')+':</div>';
          for ( var k in props )
            info += '<div>&nbsp;&nbsp;'+k+(props[k]?'&nbsp;&nbsp;=>&nbsp;&nbsp;'+props[k]:'')+'</div>';
        }
      } );
    $('#textinfo').html(info);
  }

  /// Setup properties modal box ///
  var
  prop_elem = null,
  prop_modal = $('#prop-modal');
  props = $('#props');
  $('#prop-modal .close').click(closePropModal);
  $(window).click( function (event) { if (event.target == prop_modal[0]) closePropModal(); } );
  Mousetrap.bind( 'mod+e', function () { openPropertyModal($('.selected')); } );

  function closePropModal() {
    flushPropertyModal();
    prop_modal.removeClass('modal-active');
  }

  function flushPropertyModal() {
    var keys = [];
    props.find('div:not([isnew])').each( function () {
        var
        key = $(this).find('input.key').val().trim();
        if ( ! key )
          $(this).find('button').click();
        else
          keys.push(key);
      } );
    props.find('div[isnew]').each( function () {
        var
        key = $(this).find('input.key').val().trim(),
        val = $(this).find('input.val').val().trim();
        if ( ! key )
          return;
        if ( $.inArray(key,keys) >= 0 )
          return pageCanvas.warning('Refusing to replace duplicate property: key='+key);
        pageCanvas.util.setProperty( key, val, prop_elem );
      } );
    Mousetrap.unbind('alt+a');
    props.empty();
    $('#props-target').html();
    if ( prop_elem ) {
      setPropertyTag(prop_elem);
      updateSelectedInfo();
    }
    prop_elem = null;
  }

  function setPropertyTag( elem ) {
    $('.prop-tag').remove();
    var nprops, bbox, text;
    elem = typeof elem === 'undefined' ? $('.Page').parent() : elem;
    if ( elem.length === 0 )
      return;
    nprops = elem.children('.Property').length;
    bbox = elem[0].getBBox();
    text = $(document.createElementNS( pageCanvas.util.sns, 'text' ))
      .html('PROPS['+nprops+']')
      .addClass('prop-tag')
      .click(function ( event ) { return openPropertyModal(elem,event); });
    text.attr('transform','translate('+(bbox.x+3)+','+(bbox.y-text[0].getBBox().height)+')');
    text.appendTo(elem);
  }

  function openPropertyModal( elem ) {
    if ( elem.is('.selected') )
      elem.closest('g');
    else
      elem = $('.Page').parent();
    populatePropertyModal(elem);
    prop_modal.addClass('modal-active');
    $('#props input.key').focus();
    event.stopPropagation();
  }

  function populatePropertyModal( elem ) {
    flushPropertyModal();
    var
    isreadonly = pageCanvas.util.isReadOnly(elem),
    add = $('<button tabIndex="-1">Add new property (alt+a)</button>');//,
    target = $('#selectedType').text()+' '+$('#selectedId').text();
    prop_elem = elem;

    $('#props-target').html( target === '- -' ? 'Document' : $('#selectedType').text()+' '+$('#selectedId').text() );

    function addPropInput( prop, isnew ) {
      var
      div = $('<div/>'),
      key = $('<input tabIndex="1" class="key mousetrap" type="text" value="'+prop.attr('key')+'"/>'),
      val = $('<input tabIndex="1" class="val mousetrap" type="text" value="'+(typeof prop.attr('value') === 'undefined' ? '' : prop.attr('value'))+'"/>'),
      del = $('<button tabIndex="-1">DEL</button>');
      if ( isreadonly ) {
        key.prop('disabled',true);
        val.prop('disabled',true);
      }
      if ( typeof isnew !== 'undefined' && isnew )
        div.attr('isnew','');
      key.on( 'input', function () {
          prop.attr('key',key[0].value);
          key.removeClass('field-invalid');
          var tkey = key.val().trim();
          var dkey = props.find('input.key').filter(function(){return this.value.trim()==tkey;});
          if ( tkey.length > 0 && dkey.length > 1 )
            dkey.addClass('field-invalid');
          if ( ! div.is('[isnew]') )
            pageCanvas.registerChange('properties '+elem.attr('id'));
        } );
      val.on( 'input', function () {
          prop.attr('value',val[0].value);
          pageCanvas.registerChange('properties '+elem.attr('id'));
        } );
      del.click( function () {
          if ( isreadonly )
            return pageCanvas.warning('Not possible to remove properties from read only elements');
          if ( confirm('Delete property ("'+prop.attr('key')+'","'+prop.attr('value')+'") from '+elem.attr('class').replace(/ .*/,'')+' with id='+elem.attr('id')+'?') ) {
            div.remove();
            pageCanvas.util.delProperty( prop.attr('key'), elem );
            setPropertyTag(elem);
          }
        } );
      div
        .append('Key:').append(key)
        .append('Value:').append(val)
        .append(del)
        .insertBefore(add);
      key.focus();
    }

    props.empty();
    props.append(add);
    Mousetrap.bind( 'alt+a', function () { add.click(); return false; } );
    elem.children('.Property:not([key=protected])').each( function () { addPropInput( $(this) ); } );
    add.click( function () {
        if ( isreadonly )
          return pageCanvas.warning('Not possible to add properties to read only elements');
        addPropInput( $(document.createElementNS(pageCanvas.util.sns,'g')).addClass('Property').attr('key','').attr('value',''), true );
      } );
  }

  /// Ask before modifying polyrect or rect ///
  var axisaligned = $('#axisAligned input');
  function confirmCoordsChange( elem ) {
    if ( $(elem).is('.Coords') ) {
      var parent = $(elem).parent()[0];
      if ( $(parent).is('.TextLine[polystripe]') ) {
        if ( confirm('WARNING: TextLine with id '+parent.id+' will no longer be a polystripe. Continue?') )
          $(parent).removeAttr('polystripe');
        return false;
      }
      else if ( $(parent).is('.TextLine[polyrect]') ) {
        if ( confirm('WARNING: TextLine with id '+parent.id+' will no longer be a polyrect. Continue?') )
          $(parent).removeAttr('polyrect');
        return false;
      }
      else if ( ! axisaligned.prop('checked') && pageCanvas.util.isAxisAligned(elem) ) {
        if ( ! confirm('WARNING: '+($(parent).attr('class').replace(/ .*/,''))+' with id '+parent.id+' will no longer be an axis aligned polygon. Continue?') )
          return false;
      }
    }
    return true;
  }

  /// Resize container when window size changes ///
  function adjustSize() {
    var height = $(window).innerHeight() - $('#statusBar').outerHeight();
    if ( $('#hide-text-edit input').prop('checked') )
      height -= $('#textedit').outerHeight();
    $.stylesheet('#page_styles { .page_container }').css( 'height', height+'px' );
    $.stylesheet('#page_styles { #cursor }').css( 'bottom', $('#hide-text-edit input').prop('checked') ? $('#textedit').outerHeight()+'px' : 0 );
    pageCanvas.adjustViewBox();
  }
  adjustSize();
  $(window).resize(adjustSize);

  /// Make text edit box resizable and hidable ///
  $('#textedit').click( function () { window.setTimeout( function () { $('html').css('cursor',''); }, 50 ); } ); // interact.js resize cursor bug
  interact('#textedit')
    .resizable( { edges: { left: false, right: false, bottom: false, top: true } } )
    .on( 'resizemove', function ( event ) {
        $.stylesheet('#page_styles { #textedit, #textinfo }').css( 'height', event.rect.height+'px' );
        saveDrawerState();
        adjustSize();
      } );

  /// Make text info resizable ///
  interact('#textinfo')
    .resizable( { edges: { left: true, right: false, bottom: false, top: false } } )
    .on( 'resizemove', function ( event ) {
        $.stylesheet('#page_styles { #textinfo }').css( 'width', event.rect.width+'px' );
        $.stylesheet('#page_styles { #textedit }').css( 'padding-right', event.rect.width+'px' );
        saveDrawerState();
      } );

  /// Cursor coordinates ///
  var
  cursorX = $('#cursorX'),
  cursorY = $('#cursorY');
  function updateCursor( point ) {
    cursorX.text(point.x.toFixed(0));
    cursorY.text(point.y.toFixed(0));
  }
  $('#cursor').mouseover( function () { $('#cursor').toggleClass('cursor-left cursor-right'); } );

  /// Highlighting of editables for a moment ///
  function highlightEditables( timeout ) {
      if ( typeof timeout === 'undefined' || timeout ) {
        //$('.editable').addClass('highlight');
        $('#xpg').addClass('highlight');
        var num = ++hTimeoutNum;
        window.setTimeout( function () {
            if ( num == hTimeoutNum )
              $('#xpg').removeClass('highlight');
              //$('.highlight').removeClass('highlight');
          }, 500 );
      }
      else
        $('#xpg').toggleClass('highlight');
        //$('.editable').toggleClass('highlight');
      return false;
    }
  var hTimeoutNum = 0;
  $('#modeElement').on( 'click', highlightEditables );
  Mousetrap.bind( 'mod+h', highlightEditables );
  Mousetrap.bind( 'mod+shift+h', function () { highlightEditables(false); } );

  /// Show only image for a moment ///
  function showOnlyImage( timeout ) {
      if ( typeof timeout === 'undefined' || timeout ) {
        $('#xpg').addClass('onlyimage');
        var num = ++iTimeoutNum;
        window.setTimeout( function () {
            if ( num == iTimeoutNum )
              $('.onlyimage').removeClass('onlyimage');
          }, 500 );
      }
      else
        $('#xpg').toggleClass('onlyimage');
      return false;
    }
  var iTimeoutNum = 0;
  Mousetrap.bind( 'mod+i', showOnlyImage );


  /// xpath support for filter ///
  function svgResolver() { return pageCanvas.util.sns; }

  /// Setup text filter ///
  var
  filterHistory = [],
  filterPosition = -1,
  textfilter_input = $('#textFilter input')[0],
  textfilter = $('#textFilter');

  function filterMode() {
    var
    jqfilter = '',
    text = textfilter_input.value.replace(/[\t\n\r]+/g,' ').trim();
    if ( textfilter.is(':visible') && text ) {
      if ( text[0] !== '!' )
        text.split(/\s+/)
          .forEach( function( w ) {
            w = w.trim();
            jqfilter += /[.[:#]/.test(w[0]) ? w : ':contains("'+w+'")';
          } );
      else {
        $('.xpath-select').removeClass('xpath-select');
        var
        num = 0,
        sel = [];
        try {
          var
          iter = document.evaluate(text.substr(1), pageCanvas.util.svgRoot, svgResolver, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null),
          node = iter.iterateNext();
          while ( node ) {
            num++;
            sel.push(node);
            node = iter.iterateNext();
          }
        } catch ( e ) {}
        $(sel).addClass('xpath-select');
        if ( num > 0 )
          jqfilter = '.xpath-select';
      }
    }
    pageCanvas.cfg.modeFilter = jqfilter;
    handleEditMode();
    $(textfilter_input).focus();
    return false;
  }
  $(textfilter_input)
    .on( 'input', filterMode )
    .on( 'keyup', function (e) {
        if ( e.keyCode == 38 /*up*/ || e.keyCode == 40 /*down*/ ) {
          var newFilterPosition = filterPosition + ( e.keyCode == 38 ? +1 : -1 );
          if ( newFilterPosition >= 0 && newFilterPosition < filterHistory.length ) {
            filterPosition = newFilterPosition;
            textfilter_input.value = filterHistory[filterPosition];
            filterMode();
          }
        }
        else if ( e.keyCode === 13 /*enter*/ ) {
          handleEditMode();
          $(e.target).focus();
          addToFilterHistory();
        }
      } );
  Mousetrap.bind( 'mod+f', function () {
      if ( ! textfilter.is(':visible') ) {
        textfilter.toggle();
        $('.xpath-select').removeClass('xpath-select');
        filterHistory = localStorage.filterHistory ? JSON.parse(localStorage.filterHistory) : [];
      }
      $(textfilter_input).focus();
      return filterMode();
    } );
  function clearFilter() {
    textfilter.toggle(false);
    $('.xpath-select').removeClass('xpath-select');
    filterMode();
  }
  $('#clearFilter').click(clearFilter);
  Mousetrap.bind( 'mod+shift+f', clearFilter );
  function addToFilterHistory() {
    var text = textfilter_input.value.replace(/[\t\n\r]+/g,' ').trim();
    if ( filterHistory.length > 0 && filterHistory[0] == text )
      return;
    filterHistory.unshift(text);
    if ( filterHistory.length > 1000 )
      filterHistory = filterHistory.slice(0, 1000);
    localStorage.filterHistory = JSON.stringify(filterHistory);
  }

  /// Make jQuery :contains case insensitive to improve filter usage experience ///
  jQuery.expr[':'].Contains = function(a, i, m) {
    return jQuery(a).text().toUpperCase()
        .indexOf(m[3].toUpperCase()) >= 0;
  };
  jQuery.expr[':'].contains = function(a, i, m) {
    return jQuery(a).text().toUpperCase()
        .indexOf(m[3].toUpperCase()) >= 0;
  };

  /// Drawer button ///
  Mousetrap.bind( 'mod+m', function () { $('#drawerButton').click(); return false; } );
  $('#drawerButton').click( function() {
      $('#drawer').toggle();
      $(this).toggleClass('is-active');
    } );

  /// Save state of drawer in local storage ///
  function saveDrawerState() {
    var drawerState = {};
    $('#drawer label').each( function () {
        var input = $(this).children('input');
        switch( input.attr('type') ) {
          case 'checkbox':
            drawerState[this.id] = input.prop('checked');
            break;
          case 'radio':
            if ( input.prop('checked') )
              drawerState[input.attr('name')] = this.id;
            break;
          case 'text':
            drawerState[this.id] = input.val();
            break;
        }
      } );
    $('#drawer select').each( function () {
        drawerState[$(this).attr('name')] = $(this).val();
      } );

    drawerState.bottom_pane_height = $('#textedit').css('height');
    drawerState.bottom_info_width = $('#textinfo').css('width');

    localStorage.drawerState = JSON.stringify(drawerState);
  }

  /// Load drawer state from local storage ///
  function loadDrawerState() {
    if ( typeof localStorage.drawerState === 'undefined' ) {
      console.log('warning: drawer state not found in local storage');
      return handleEditMode();
    }

    var drawerState = JSON.parse(localStorage.drawerState);
    $('#drawer label').each( function () {
        var input = $(this).children('input');
        switch( input.attr('type') ) {
          case 'checkbox':
            if ( typeof drawerState[this.id] !== 'undefined' )
              input.prop('checked',drawerState[this.id]);
            break;
          case 'radio':
            if ( typeof drawerState[input.attr('name')] !== 'undefined' &&
                 drawerState[input.attr('name')] === this.id )
              input.prop('checked',true);
            break;
          case 'text':
            if ( typeof drawerState[this.id] !== 'undefined' )
              input.val(drawerState[this.id]);
            break;
        }
      } );
    $('#drawer select').each( function () {
        if ( typeof drawerState[$(this).attr('name')] !== 'undefined' )
          $(this).val(drawerState[$(this).attr('name')]);
      } );
    if ( 'bottom_pane_height' in drawerState ) {
      $.stylesheet('#page_styles { #textedit, #textinfo }').css( 'height', drawerState.bottom_pane_height );
      adjustSize();
    }
    if ( 'bottom_info_width' in drawerState )
      $.stylesheet('#page_styles { #textinfo }').css( 'width', drawerState.bottom_info_width );

    handleEditMode();
  }

  /// Restore saved drawer state on window initialization ///
  loadDrawerState();

  /// Save drawer state on non-mode drawer changes ///
  $('#generalFieldset input, #newPropsFieldset input, #visibilityFieldset input')
    .change(saveDrawerState);

  /// Setup page rotations ///
  function handlePageRotation( event ) {
    pageCanvas.util.rotatePage( event.target.id === 'rotateClockwise' ? 90 : -90 );
    return false;
  }
  $('#rotateClockwise, #rotateAnticlockwise').click(handlePageRotation);

  /// Setup visibility checkboxes ///
  function handleVisibility() {
    if ( this.id === 'hide-text-edit' )
      adjustSize();
    return $(this).children('input').prop('checked') ?
      $('#container').removeClass(this.id) :
      $('#container').addClass(this.id) ;
  }
  $('label[id^=hide-]')
    .each(handleVisibility)
    .click(handleVisibility);

  /// Setup selected centering checkbox ///
  function handleAutoCenter() {
    pageCanvas.cfg.centerOnSelection =
      $(this).children('input').prop('checked') ? true : false ;
  }
  $('#centerSelected')
    .each(handleAutoCenter)
    .click(handleAutoCenter);

  /// Setup selected centering checkbox ///
  function handleXmlTextValidate() {
    pageCanvas.cfg.textValidator = $(this).children('input').prop('checked') ?
      pageCanvas.util.strXmlValidate :
      function () { return false; };
  }
  $('#xmlTextValidate')
    .each(handleXmlTextValidate)
    .click(handleXmlTextValidate);

  /// Setup Page XML schema validation ///
  /*var
  //pagexml_xsd_file = '../xsd/pagecontent_searchink.xsd',
  pagexml_xsd_file = '../xsd/ancestry-vienna.xsd',
  pagexml_xsd = false;
  function loadPageXmlXsd( async ) {
    if ( ! pagexml_xsd )
      $.ajax({ url: pagexml_xsd_file, async: async, dataType: 'xml' })
        .fail( function () { pageCanvas.throwError( 'Failed to retrieve '+pagexml_xsd_file ); } )
        .done( function ( data ) {
            pagexml_xsd = (new XMLSerializer()).serializeToString(data);
            try {
              xmllint.validateXML({ xml: '<text></text>', schema: pagexml_xsd });
            } catch ( e ) {
              window.e = e;
              window.xsd = pagexml_xsd;
            }
          } );
  }
  loadPageXmlXsd(true);

  function validatePageXml() {
    // @todo check that a page is loaded
    loadPageXmlXsd(false);
    var
    pageXml = pageCanvas.getXmlPage(),
    val = xmllint.validateXML({ xml: pageXml, schema: pagexml_xsd });
    if ( val.errors ) {
      val.errors = val.errors.map( function (x) { return x.replace(/file_0\.xml:/,''); } ).join('<br/>');
      alert( 'Page XML validation failed: '+val.errors );
    }
    else
      alert( 'Page XML validates' );
  }
  $('#pageXmlValidate').on('click',validatePageXml);*/

  /// Setup readme ///
  function populateReadme() {
    $.ajax({ url: '../README.md', dataType: 'text' })
      .fail( function () { console.log('Failed to retrieve readme.'); } )
      .done( function ( data ) {
          $('#readme-modal > .modal-content')[0].innerHTML = marked(data);
          var
          ul = $('<ul/>'),
          content = $('#readme-modal > .modal-content'),
          versions = pageCanvas.getVersion(),
          keys = Object.keys(versions).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
          for ( var k in keys ) {
            k = keys[k];
            $('<li>'+k+': '+versions[k]+'</li>').appendTo(ul);
            //console.log(k+': '+versions[k]);
          }
          $('<h1>Component versions</h1>').appendTo(content);
          ul.appendTo(content);
        } );
  }
  $('#openReadme').click( function () {
      if ( $('#readme-modal > .modal-content').find('*').length === 0 )
        populateReadme();
      $('#readme-modal').addClass('modal-active');
    } );

  $('.modal-content').click( function (e) { e.stopPropagation(); } );
  $('[id$=-modal]').click( function () { $('.modal-active').removeClass('modal-active'); } );

  /// Setup text properties ///
  function handleReadingDirection() {
    if ( $(this).children('input').prop('checked') )
      pageCanvas.cfg.readingDirection = $(this).children('input').attr('value');
  }
  $('label[id^=read-]')
    .each(handleReadingDirection)
    .click(handleReadingDirection);
  function handleTextOrientation() {
    if ( $(this).children('input').prop('checked') )
      switch ( $(this).children('input').attr('value') ) {
        case 'u':
          pageCanvas.cfg.baselineFirstAngleRange = [ -Math.PI/4, Math.PI/4 ];
          break;
        case 'l':
          pageCanvas.cfg.baselineFirstAngleRange = [ Math.PI/4, 3*Math.PI/4 ];
          break;
        case 'r':
          pageCanvas.cfg.baselineFirstAngleRange = [ -3*Math.PI/4, -Math.PI/4 ];
          break;
        //case 'd':
        //  pageCanvas.cfg.baselineFirstAngleRange = [ 3*Math.PI/4, -3*Math.PI/4 ];
        //  break;
        case 'a':
          pageCanvas.cfg.baselineFirstAngleRange = null;
          break;
      }
  }
  $('label[id^=orient-]')
    .each(handleTextOrientation)
    .click(handleTextOrientation);

  /// Setup table size ///
  $('label[id^="table-"] input')
    .on( 'input', handleTableSize );
  function handleTableSize () {
    pageCanvas.cfg.tableSize = [
      parseInt($('input[name="table-rows"]').val()),
      parseInt($('input[name="table-cols"]').val()) ];
  }
  handleTableSize();

  /// Setup edit mode after create ///
  function editModeAfterCreate( elem, elem_type ) {
    if ( ! $('#editAfterCreate input')[0].checked )
      return;
    window.setTimeout( function () {
        if ( elem_type === 'Baseline' )
          $('#baseMode input')[0].checked = true;
        else
          $('#coorMode input')[0].checked = true;
        handleEditMode(false);
        $(elem).click();
      }, 200 );
  }

  /// Setup tab selection ///
  $('#tab-sort, [id^=tab-sort-]')
    .each(handleTabSort)
    .click(handleTabSort);
  function handleTabSort() {
    var radio = $('label[id^=tab-sort-] input');
    radio.prop('disabled',true).parent().addClass('disabled');
    if ( $('#tab-sort input').prop('checked') ) {
      var sel = '.'+radio.filter(':checked').attr('value');
      console.log('sort sel: '+sel);
      pageCanvas.cfg.editablesSortCompare = function (a,b) { return decreasingConf(a,b,sel); };
      radio.prop('disabled',false).parent().removeClass('disabled');
    }
    else
      pageCanvas.cfg.editablesSortCompare = null;
    pageCanvas.mode.current();
    saveDrawerState();
  }

  function decreasingConf(a, b, sel) {
    var
    ca = $(a).children(sel).attr('conf'),
    cb = $(b).children(sel).attr('conf');
    ca = typeof ca === 'undefined' ? 1e10 : parseFloat(ca);
    cb = typeof cb === 'undefined' ? 1e10 : parseFloat(cb);
    return cb - ca;
  }

  /// Handle text clip ///
  $('#clip-text-reg')
    .each(handleTextClip)
    .click(handleTextClip);
  function handleTextClip() {
    pageCanvas.util.setTextClipping( $(this).children('input').prop('checked') );
  }

  /// Setup edit mode selection ///
  function handleEditMode( showHightlight ) {
    $('.highlight').removeClass('highlight');

    var
    text_checked = $('#textMode input').prop('checked'),
    rect_checked = $('#coordsRestriction').val() === '4',
    axis_checked = $('#axisAligned input').prop('checked'),
    line_type = $('#textlineRestriction').val(),
    page = $('#pageMode input'),
    region = $('#regMode input'),
    line = $('#lineMode input'),
    word = $('#wordMode input'),
    glyph = $('#glyphMode input'),
    table = $('#tabMode input'),
    select = $('#selMode input'),
    baseline = $('#baseMode input'),
    coords = $('#coorMode input'),
    drag = $('#dragMode input'),
    create = $('#createMode input');

    pageCanvas.cfg.coordsMaxPoints = rect_checked ? 4 : 0;

    var coords_restriction = false;
    if ( $('#coordsRestriction').val() === '4' && axis_checked )
      coords_restriction = pageCanvas.enum.restrict.AxisAlignedRectangle;
    else if ( axis_checked )
      coords_restriction = pageCanvas.enum.restrict.AxisAligned;

    $('#editModesFieldset input')
      .prop('disabled',false)
      .parent()
      .removeClass('disabled');

    /// Page mode ///
    if ( page.prop('checked') ) {
      select.prop('checked',true);
      pageCanvas.mode.pageSelect();
      /// Disable invalid ///
      baseline.prop('disabled',true).parent().addClass('disabled');
      coords.prop('disabled',true).parent().addClass('disabled');
      drag.prop('disabled',true).parent().addClass('disabled');
      create.prop('disabled',true).parent().addClass('disabled');
    }

    /// Region modes ///
    else if ( region.prop('checked') ) {
      /// Region select ///
      if ( select.prop('checked') )
         pageCanvas.mode.regionSelect( text_checked );
      /// Region baselines ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.regionBaselines() ;
      /// Region coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.regionCoords( text_checked, coords_restriction );
      /// Region drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.regionDrag( text_checked );
      /// Region create ///
      else if( create.prop('checked') )
        pageCanvas.mode.regionCoordsCreate( coords_restriction );
    }

    /// Line modes ///
    else if ( line.prop('checked') ) {
      /// Line select ///
      if ( select.prop('checked') )
        pageCanvas.mode.lineSelect( text_checked );
      /// Line baseline ///
      else if( baseline.prop('checked') )
        pageCanvas.mode.lineBaseline( text_checked, coords_restriction );
      /// Line coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.lineCoords( text_checked, coords_restriction );
      /// Line drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.lineDrag( text_checked );
      /// Line create ///
      else if( create.prop('checked') ) {
        var line_restriction = false;
        if ( line_type === '4' && axis_checked )
          line_restriction = pageCanvas.enum.restrict.AxisAlignedRectangle;
        else if ( axis_checked )
          line_restriction = pageCanvas.enum.restrict.AxisAligned;
        if ( line_type === '4' || line_type === '3+' ) {
          pageCanvas.cfg.coordsMaxPoints = line_type === '4' ? 4 : 0;
          pageCanvas.mode.lineCoordsCreate( line_restriction );
        }
        else {
          pageCanvas.cfg.polyrectOffset = parseFloat($('#baselineOffset').val());
          pageCanvas.cfg.baselineMaxPoints = line_type === '1' ? 2 : 0;
          pageCanvas.mode.lineBaselineCreate( line_restriction );
        }
      }
    }

    /// Word modes ///
    else if ( word.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Word select ///
      if ( select.prop('checked') )
        pageCanvas.mode.wordSelect( text_checked );
      /// Word coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.wordCoords( text_checked, coords_restriction );
      /// Word drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.wordDrag( text_checked );
      /// Word create ///
      else if( create.prop('checked') )
        pageCanvas.mode.wordCoordsCreate( coords_restriction );
    }

    /// Glyph modes ///
    else if ( glyph.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Glyph select ///
      if ( select.prop('checked') )
        pageCanvas.mode.glyphSelect( text_checked );
      /// Glyph coords ///
      else if( coords.prop('checked') )
        pageCanvas.mode.glyphCoords( text_checked, coords_restriction );
      /// Glyph drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.glyphDrag( text_checked );
      /// Glyph create ///
      else if( create.prop('checked') )
        pageCanvas.mode.glyphCoordsCreate( coords_restriction );
    }

    /// Table modes ///
    else if ( table.prop('checked') ) {
      /// Disable invalid ///
      if ( baseline.prop('checked') )
        select.prop('checked',true);
      baseline.prop('disabled',true).parent().addClass('disabled');
      /// Table select ///
      if ( select.prop('checked') )
        pageCanvas.mode.cellSelect( text_checked );
      /// Table points ///
      else if( coords.prop('checked') )
        pageCanvas.mode.tablePoints( axis_checked ? pageCanvas.enum.restrict.AxisAlignedRectangle : null );
      /// Table drag ///
      else if( drag.prop('checked') )
        pageCanvas.mode.tableDrag();
      /// Table create ///
      else if( create.prop('checked') )
        pageCanvas.mode.tableCreate( axis_checked ? pageCanvas.enum.restrict.AxisAlignedRectangle : null );
    }

    $('#modeElement').text('-/'+$('.editable').length);
    if ( typeof showHightlight === 'undefined' || showHightlight )
      highlightEditables();
    saveDrawerState();
  }
  $('#editModesFieldset input, #newPropsFieldset select, #newPropsFieldset input')
    .change(handleEditMode);

  /// Handle round points ///
  $('#roundPoints')
    .each(handleRoundPoints)
    .click(handleRoundPoints);
  function handleRoundPoints() {
    pageCanvas.cfg.roundPoints = $(this).children('input').prop('checked');
  }
} );
