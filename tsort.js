

$.widget("ui.tsort", {
	
	ajax: null,
	ajaxDeferer: null,
	
	page: 1,
	row_h: 0,
	rowsPerPage: 0,
	rowsLoaded: 0,
	totalRows: 0,
	prevScrollTop: 0,
	pageLoading: null,
	lastLoadedPage: 0,
	
	scrollDeferer: null,
	
	rowCounter: 0,
	
	selectedRows: [],
			
	_init: function()
	{		
		var self = this
		, options = self.options 
		, uniqueSuffix = (self.uniqueSuffix = $('.t-wpr').length + 1)
		, wpr = (self.wpr = self.element
					.addClass('t-wpr t-wpr-'+uniqueSuffix)
					.attr('unselectable', 'on')
				)
		;
		
		// IE always has problems everywhere
		self.isIE = /*@cc_on!@*/false;
		
		// Opera fails to support <col> elements properly, hence we need to know when to activate a workaround
		self.isOpera = window.opera ? true : false;
		
		// WebKit has weird sorting problems
		self.isWebKit = RegExp(" AppleWebKit/").test(navigator.userAgent);
				
		// set intial stylings
		wpr.css({
			width: options.width,
			height: options.height
		});
		
		// initialize options.order
		if (options.order === null)
		{
			options.order = [];
			for (var i = 0; i < options.model.length; i++)
				options.order.push(i);
		}
				
		self.construct(options.model, options.order);	
	},
	
	
	_tableHTML: function(m, o)
	{	
		var self = this
		, tbl_html = '';
		
		// generate html for titles table
		tbl_html += '<div class="t-hd-wpr">';
		tbl_html += self._generateTableOpenTag('t-hd', m, o);
		tbl_html += '<tr>';
		$.each(o, function(i, index) 
		{					
			tbl_html += '<th class="t-hd-'+m[index].key+(m[index].hidden ? ' t-hidden' : '')+'">';
			tbl_html += '<span class="t-hd-label">' + m[index].name +'</span></th>';
		});
		tbl_html += '</tr>';
		tbl_html += '</table></div>';
		
		// generate html for body
		tbl_html += '<div class="t-bd-wpr">';
		tbl_html += self._generateTableOpenTag('t-bd', m, o);
		tbl_html += '<tbody></tbody></table>';
		tbl_html += '<div class="t-anchor">&nbsp;</div>'; // opera needs this to visualize scrollbar properly
		tbl_html += '</div>';
		
		return tbl_html;
	},
	
	_generateTableOpenTag: function(el_class, m, o)
	{
		var self = this,
			col_tr = '',
			tbl_width = 0;
			
		$.each(o, function(i, index) 
		{			
			if (typeof m[index].width != 'undefined')
				col_width = m[index].width;
			else if (m[index].hidden)
				col_width = 0;
			else
				col_width = self.options.columnTemplate.width;
		
			tbl_width += col_width;
			col_tr += '<col width="'+col_width+'" />';
		});
		
		// for table-layout:fixed; to work properly in WebKit table has to have the width pre-assigned
		return '<table class="'+el_class+'" cellpadding="0" cellspacing="0" style="width:'+tbl_width+'px">'+col_tr;
	},
	
	
	construct: function(m, o)
	{
		var self = this;
		
		self.element.html(self._tableHTML(m, o));
		
		self.bd = self.element.find('.t-bd');
		self.bd_wpr = self.element.find('.t-bd-wpr');
		self.hd = self.element.find('.t-hd');
		self.hd_wpr = self.element.find('.t-hd-wpr');
		
		// set body wrapper height
		var bd_wpr_h = self.wpr.height() - self.hd_wpr.height();
		self.bd_wpr.height(bd_wpr_h);
		
		// set rows per page depending on body wrapper height
		var row = self.bd.find('tr:first'), row_h;
		if (row.length)
			row_h = row.height(); // this probably will never get executed... but anyway
		else
		{
			// commit an artificial height measurement
			var test_tr = $('<tr><td colspan="'+self.options.order.length+'">&nbsp;</td></tr>').appendTo(self.bd.find('tbody'));
			row_h = test_tr.height();
			test_tr.remove();				
		}
		self.row_h = row_h;
		self.rowsPerPage = Math.ceil(bd_wpr_h / row_h) + self.options.rows2Edge * 2;
		
		self.bd_wpr.scroll(function()
		{
			// scroll the header and the body synchronously	
			self.hd_wpr.scrollLeft(self.bd_wpr.scrollLeft());
						
			// if auto loading of the rows on scroll set, handle it
			if (self.options.autoLoadingRows && self.pageLoading == null)
			{
				if (self.scrollDeferer != null)
				{
					clearInterval(self.scrollDeferer);	
					self.scrollDeferer = null;
				}
				self.scrollDeferer = setTimeout(function() { self._autoLoadRows.call(self); }, self.options.scrollRate);
			}
		});
		
		if (self.options.autoPopulate) { self._makeAjaxRequest({}, self.populate); }
		
		self._activateRequestedFeatures();
	},
	
	
	_activateRequestedFeatures: function()
	{
		this._activateRequestedHeaderFeatures();
		this._activateRequestedBodyFeatures();
	},
	
	_activateRequestedHeaderFeatures: function()
	{
		(this.options.draggableColumns && $.fn.sortable && this.makeColumnsDraggable());
		(this.options.resizableColumns && $.fn.draggable && this.makeColumnsResizable());	
	},
	
	
	_activateRequestedBodyFeatures: function()
	{
		(this.options.selectableRows && this.makeRowsSelectable());	
		(this.options.sortableRows && this.options.selectableRows && this.makeRowsSortable());	
	},
	
	
	// takes in JSON and populates the grid
	populate: function(data, actionAfterLoad)
	{
		var self = this
		,bd_rows = ''
		,m = self.options.model 
		,o = self.options.order
		,numRows = 0
		;
		
		if ($.inArray(actionAfterLoad, ['append', 'prepend']) === -1)
		{
			actionAfterLoad = 'html';
			self.rowsLoaded = 0; // reset the row counter
		}
				
		$.each(data.rows, function(i, r) {
			bd_rows += '<tr id="'+(r.id || 't-row-'+self.uniqueSuffix+'-'+self._uniqid())+'" class="t-row">';
			$.each(o, function(i, index) {
				bd_rows += '<td class="t-bd-'+m[index].key+(m[index].hidden ? ' t-hidden' : '')+'">' + r[index] + '</td>';
			});
			bd_rows += '</tr>';
			numRows++;
		});
		
		self.rowsLoaded += numRows;
		self.totalRows = (typeof data.totalRows != 'undefined' ? data.totalRows : numRows);
		
		self.lastLoadedPage = parseInt(data.page);
				
		self.bd.find('tbody')[actionAfterLoad](bd_rows);
				
		// adjust scrollbar position if autoLoadingRows in action
		(self.options.autoLoadingRows && self.adjustScrollbar(actionAfterLoad));
		
		// make sure that number of loaded rows stays within constraints
		(self.options.autoLoadingRows && self._controlPopulation());
		
		self._trigger('reconstructed');
		
		// notify the world that complete repopulation has happened
		if (actionAfterLoad == 'html') self._trigger('repopulate');

	},
	
	
	makeColumnsDraggable: function()
	{
		var self = this
		,indexStart
		;
		
		self.hd.find('tr:first').sortable({
			
			items: 'th:not(.t-hidden)',
			axis: 'x',
			cancel: '.t-hidden',
			placeholder: 't-placeholder',
			forceHelperSize: true,
			forcePlaceholderSize: true,
			tolerance: 'pointer',
			
			helper: function(e, th)
			{
				return th.clone().find('.t-hd-resizer').remove().end();
			},

			start: function(e, ui) {				
				indexStart = $('th', this).index(ui.item.get(0));
			},
	
			stop: function(e, ui) {
				var indexStop = $('th', this).index(ui.item.get(0))
				,min = Math.min(indexStart, indexStop)
				,max = Math.max(indexStart, indexStop)
				;		
				
				if (indexStop == self.options.order.length - 1 && self.isWebKit) self._redrawHeader();			
					
				if (indexStart == indexStop)
					return;
				
				$(this).sortable('disable');
				
				// move columns
				self.bd.find('tr').each(function() 
				{
					var tdMin = $(this).find('td').eq(min),
						tdMax = $(this).find('td').eq(max);
							
					tdMax.insertBefore(tdMin);
				});
				
				// retain columns widths
				var colMin = self.hd.find('col').eq(min),
					colMax = self.hd.find('col').eq(max);
				
				colMax.insertBefore(colMin);
				
				var colMin = self.bd.find('col').eq(min),
					colMax = self.bd.find('col').eq(max);
				
				colMax.insertBefore(colMin);
				
				$(this).sortable('enable');
			}
		});

	},
	
	
	makeColumnsResizable: function()
	{
		var self = this
		,ths = self.hd.find('th')
		,helper = null
		;
		
		$('<span class="t-hd-resizer">&nbsp;</span>')
			.appendTo(ths);
			
		ths.each(function(i) {
						
			$('.t-hd-resizer', this).draggable({
				appendTo: self.element,
				axis: 'x',
	
				helper: function()
				{
					return $('<div id="t-hd-resize-helper" />')
						.css({
							height: self.wpr.height(),
							top: self.wpr.offset().top
						});
				},
				
				start: function()
				{	
					$(this).parent().addClass('t-selected');
				},
				
				stop: function(e, ui)
				{
					var th = $(this).parent().removeClass('t-selected')
					,xy = th.offset()
					,new_w = ui.offset.left - xy.left
					,i = th.parent().find('th').index(th)
					;
										
					self.resizeCol(i, new_w); 
					
					if (self.options.draggableColumns && self.isIE) 
						self.hd.find('tr:first').sortable('option', 'disabled', false);
				}
			});
			
		});
		
		// constrain resizer movement
		self.hd.find('.t-hd-resizer').mousedown(function(e) // we need to explicitly bind mousedown to resizers for IE
		{
			if ($(e.target).is('.t-hd-resizer'))
			{
				var th = $(e.target).parent()
				,xy = th.offset()
				,h = th.innerHeight()
				,w = th.innerWidth()
				,min_w = $('.t-hd-label', th).width() + (th.innerWidth() - th.width()) // min width = label width + th padding
				,max_w = Math.max(w, self.options.maxColWidth) // max width cannot be less the th default width
				;
				
				$(e.target).draggable('option', 'containment', 
					[xy.left + min_w, xy.top, xy.left + max_w, xy.top + h]
				);
				
				// there's UI+IE bug on nested draggables: http://dev.jqueryui.com/ticket/4333 
				// so we disable the column header sortable to not interfere
				if (self.options.draggableColumns && self.isIE) 
					self.hd.find('tr:first').sortable('option', 'disabled', true);
						
			}				
		});
		
	},
	
	
	resizeCol: function(i, new_w)
	{
		var self = this
		,w = self.options.model[i].width
		,diff = new_w - w
		,tbl_w = self.hd.width()
		;
		
		$([])
			.add(self.hd)
			.add(self.bd)
				.find('col:eq('+i+')')
					.attr('width', new_w)
					.end()
				.width(tbl_w + diff);
		
		// let us remember the latest width of the column
		if (!self.options.model[i].hidden)		
			self.options.model[i].width = new_w;
			
			
		// force the Opera to acknowledge the changes by redrawing the tables
		if (self.isOpera)
			self._redrawAll();
	},
	
	_redrawAll: function()
	{
		this._redrawHeader();
		this._redrawBody();
	},
	
	_redrawHeader: function()
	{
		var hd_html = self.hd_wpr.html();
		
		this.hd_wpr.empty().html(hd_html);
		this.hd = this.element.find('.t-hd');
		this._activateRequestedHeaderFeatures();
	},
	
	_redrawBody: function()
	{
		var bd_html = this.bd_wpr.html();
		
		this.bd_wpr.empty().html(bd_html);
		this.bd = this.element.find('.t-bd');
		this._activateRequestedBodyFeatures();
	},
		
	
	makeRowsSelectable: function()
	{
		var self = this;
		
		self.element.bind(self.widgetEventPrefix+'repopulate', function() { self.resetSelection.call(self); });
		
		self.bd.mouseup(function(e)
		{
			var row = $(e.target).closest('tr')
			,tbody = row.parent()
			,rowIndex = $('tr', tbody).index(row)
			,selectedRow = self.getLastSelectedRow()
			,selectedRowIndex = $('tr', tbody).index(selectedRow)
			,ctrlKey = (navigator.appVersion.indexOf("Mac")!==-1) ? e.metaKey : e.ctrlKey
			;
				
			if (!ctrlKey && !e.shiftKey) {

				if (e.which != 2 && e.which != 3 || !row.hasClass('t-selected')) // do not reset selection if context menu called
				{ 
					self.resetSelection();
					self.setSelection(row);
				}

			} else if (e.shiftKey) {

				var min = Math.min(rowIndex, selectedRowIndex),
					max = Math.max(rowIndex, selectedRowIndex);

				for (var i = min; i <= max; i++ ) 
				{
					var nextRow = $('tr', tbody).get(i);
					if (!$(nextRow).hasClass('t-selected'))
						self.setSelection(nextRow);
				}
			} else {
				self.setSelection(row);
			}
			
			// if there is anything selected dispatch the notification
			if (self.selectedRows.length) self._trigger('select', null, { selectedRows: self.selectedRows });
		});
	},
	
	
	getLastSelectedRow: function()
	{
		return this.selectedRows[this.selectedRows.length-1] || null;
	},
	
	
	setSelection: function(el)
	{
		if ($(el).hasClass('t-selected'))
		{
			var pos = $.inArray($(el)[0], this.selectedRows),
				remove = function(array, from, to) 
				{
					var rest = array.slice((to || from) + 1 || array.length);
					array.length = from < 0 ? array.length + from : from;
					return array.push.apply(array, rest);
				};
				
			if (pos !== -1)
			{
				remove(this.selectedRows, pos);
			}
			
			$(el).removeClass('t-selected');
			
			(this.options.sortableRows && $.fn.draggable && $(el).draggable('destroy'));
		}
		else
		{
			$(el).addClass('t-selected');
			this.selectedRows.push($(el)[0]);
		}	
	},
	
	unsetSelection: function(el)
	{
		if ($(el).hasClass('t-selected'))
			this.setSelection(el);
	},
	
	resetSelection: function()
	{
		$(this.selectedRows).removeClass('t-selected');
		(this.options.sortableRows && $.fn.draggable && $(this.selectedRows).draggable('destroy'));
		this.selectedRows = [];
	},
	
	
	makeRowsSortable: function()
	{
		var self = this
		,offsetCheckTimer = null
		,checkInterval = 100
		,rowUnderCursor = null
		;
		
		self.element.bind(self.widgetEventPrefix+'select', function(e, data) 
		{ 
			$(data.selectedRows).draggable({
				appendTo: self.bd_wpr,
				cursor: 'pointer',
				zIndex: 2700,
				addClasses: false,
				opacity: 0.55,
				scroll: false,
				cursorAt: {left: 0, top: 0},
				
				helper: function(e) 
				{
					return $('<div id="t-dragged"><div>'+data.selectedRows.length+'</div></div>');
				},
				
				start: function(e, ui)
				{
					// initially I used drag event, but it doesn't trigger when cursor is not moving and thus
					// doesn't cause the grid to scroll automatically; timer seemed to be a logical solution to this
					offsetCheckTimer = setInterval(function()
					{
						var bd_wpr_oTop = self.bd_wpr.offset().top
						,helper_oTop = $('#t-dragged').offset().top - bd_wpr_oTop
						,scrollPointTop = bd_wpr_oTop + self.options.rows2Edge * self.row_h
						,scrollPointBottom = bd_wpr_oTop + self.bd_wpr.height() - self.options.rows2Edge * self.row_h
						,diffTop = helper_oTop - scrollPointTop
						,diffBottom = scrollPointBottom - helper_oTop
						,scrollTop = self.bd_wpr.scrollTop()
						,rowIndex = Math.ceil((scrollTop - parseInt(self.bd.css('margin-top')) + helper_oTop) / self.row_h)
						;
						
						// show an insert point indicator line
						if (rowUnderCursor != null) rowUnderCursor.removeClass('t-insert-after-me');
						rowUnderCursor = self.bd.find('tr:eq('+rowIndex+')').addClass('t-insert-after-me');
							
						// do nothing if dragger is within the boundaries											
						if (helper_oTop >= scrollPointTop && helper_oTop <= scrollPointBottom) return;
						
						// auto scroll happens here
						scrollTop = diffTop > 0 ? scrollTop + Math.abs(diffBottom) : scrollTop - Math.abs(diffTop);
						self.bd_wpr.scrollTop(scrollTop);
						
					}, checkInterval);
				},
								
				stop: function(e, ui)
				{
					if (offsetCheckTimer != null) 
					{
						clearInterval(offsetCheckTimer);
						offsetCheckTimer = null;
					}
					
					// physycally move selected rows to a new place
					if (rowUnderCursor != null && rowUnderCursor.hasClass('t-insert-after-me'))
					{ 
						$(data.selectedRows).insertAfter(rowUnderCursor);
						rowUnderCursor.removeClass('t-insert-after-me');
					}
				}
			});
		});
	},
	
	
	hideCol: function(key)
	{
		var index = this._getColIndexByKey(key);
				
		if (index === false) return;
		
		$(this.hd.find('th').eq(index))
			.addClass('t-hidden');
		
		this.options.model[index].hidden = true;
		this.resizeCol(index, 0); 
	},
	
	unhideCol: function(key)
	{
		var index = this._getColIndexByKey(key);
		
		if (index === false) return;
		
		$(this.hd.find('th').eq(index))
			.removeClass('t-hidden');
		
		this.options.model[index].hidden = false;
		this.resizeCol(index, this.options.model[index].width);
	},
	
	
	_getColIndexByKey: function(key)
	{
		var self = this
		,o = self.options.order
		,m = self.options.model
		,index = false
		;
		
		$.each(o, function(i, v)
		{			
			if (m[v].key == key)
			{
				index = i;
				return false;	
			}
		});
		return index;
	},
	
	
	_autoLoadRows: function()
	{
		var self = this
		,scrollTop = self.bd_wpr.scrollTop()
		,offsetTop = parseInt(self.bd.css('margin-top'))
		,scrollDiff = scrollTop - self.prevScrollTop
		,page_h = self.row_h * self.rowsPerPage	
		,bd_wpr_h = self.bd_wpr.height()
		,distance2Edge = 0
		,page2Load = 0
		,actionAfterLoad = 'load'
		;
				
		if (Math.abs(scrollDiff) < self.row_h) return; // proceed only if scroll difference is noticable
		
		self.prevScrollTop = scrollTop;
		
		// set the current page
		self.page = Math.ceil(scrollTop / page_h) || 1;
				
		// if we scrolled out to an empty space		
		if (offsetTop - scrollTop > bd_wpr_h || (scrollTop - offsetTop - self.bd.height()) > bd_wpr_h)
		{			
			self.loadPage(self.page);
			return;
		}
		
		// check if we are near to the edge or have already passed it
		if (scrollDiff > 0) // scrolling down...
		{
			// lastLoadedPage should be bigger or equal when scrolling down
			if (self.isPageLoaded(self.page) && self.page > self.lastLoadedPage) 
				self.lastLoadedPage = self.page;
			
			distance2Edge = (offsetTop + self.bd.height()) - (scrollTop + self.bd_wpr.height());
			if (distance2Edge < self.options.rows2Edge * self.row_h)
			{				
				self.loadPage(self.lastLoadedPage + 1, 'append', (distance2Edge < 0));
			}
		}
		else // scrolling up...
		{
			// lastLoadedPage should be less or equal when scrolling down
			if (self.isPageLoaded(self.page) && self.page < self.lastLoadedPage) 
				self.lastLoadedPage = self.page;
							
			distance2Edge = scrollTop - offsetTop;
			if (distance2Edge < self.options.rows2Edge * self.row_h)
			{
				self.loadPage(self.lastLoadedPage - 1, 'prepend', (distance2Edge < 0));		
			}
		}				
	},
	
	adjustScrollbar: function(actionAfterLoad)
	{				
		var self = this
		,page_h = self.row_h * self.rowsPerPage
		;
					
		switch (actionAfterLoad)
		{
			case 'prepend':
				self.bd.css('margin-top', (parseInt(self.bd.css('margin-top')) - page_h) + 'px');
				break;
				
			case 'append':
				self.bd.css('margin-bottom', (parseInt(self.bd.css('margin-bottom')) - page_h) + 'px');
				break;
				
			default:
				var marginTop = (self.lastLoadedPage - 1) * page_h;
				
				if (self.lastLoadedPage != 1)
				{
					self.page = Math.ceil(self.bd_wpr.scrollTop() / page_h);
					self.bd_wpr.scrollTop(marginTop + self.options.rows2Edge * self.row_h);
				}
				else
					self.bd_wpr.scrollTop(0);
					
				self.bd.css({
					'margin-top': marginTop + 'px',
					'margin-bottom': ((Math.ceil(self.totalRows / self.rowsPerPage) - self.lastLoadedPage) * page_h) + 'px'
				});
		}
	},
	
	
	loadPage: function(page2Load, actionAfterLoad, showLoading)
	{
		var self = this,
			callback = null;
		
		if (actionAfterLoad == null)
			actionAfterLoad  = 'load';
			
		var row_h = self.bd.find('tr:first').innerHeight()	
		,page_h = row_h * self.rowsPerPage;
		
		// check that we are loading proper page
		if (page2Load == self.pageLoading || page2Load < 1 || page2Load > Math.ceil(self.totalRows / self.rowsPerPage))
			return;
			
		self.pageLoading = page2Load;
			
		callback = function(data) 
		{
			self.populate.apply(self, [data, actionAfterLoad]);
			self.pageLoading = null;
		}
				
		self._makeAjaxRequest({ page: page2Load }, callback, showLoading);
	},
	
	
	showLoading: function()
	{
	},
	
	
	hideLoading: function()
	{
		
	},
	
	
	isPageLoaded: function(page)
	{
		var self = this
		,offsetTop = parseInt(self.bd.css('margin-top'))
		,page_h = self.row_h * self.rowsPerPage
		,pageOffset = (page - 1) * page_h
		;
		
		return  pageOffset >= offsetTop  && pageOffset < offsetTop + self.bd.height();
	},
	
	
	_controlPopulation: function()
	{		
		if (this.rowsLoaded <= this.options.maxRowsVisible) return;
		
		var self = this
		,scrollTop = self.bd_wpr.scrollTop()
		,offsetTop = parseInt(self.bd.css('margin-top'))
		,offsetBottom = parseInt(self.bd.css('margin-bottom'))
		,diffTop = scrollTop - offsetTop
		,diffBottom = (self.bd.height()) + offsetTop - (scrollTop + self.row_h * self.rowsPerPage)
		,startIndex = false
		,stopIndex = false
		;
		
		if (diffTop < 0 || diffBottom < 0) return;
		
		var currentRow = Math.ceil(diffTop / self.row_h)
		,removeFromTop = currentRow > self.rowsLoaded - self.rowsPerPage - currentRow;
				
		
		if (removeFromTop) // remove one page equvalent number of rows from top
		{
			startIndex = 0;
			stopIndex = self.rowsPerPage;
		}
		else // ... from bottom
		{
			startIndex = self.rowsLoaded - self.rowsPerPage - 1;
			stopIndex = self.rowsLoaded;
		}
		
		
		// we could use rowsPerPage as max value for the loop, but that potentially can be problematic,
		// since last pages may not have enough rows, this way we do the thing as much as there are rows to remove
		for (var rowNum = startIndex; rowNum < stopIndex; rowNum++)
		{
			var row = self.bd.find('tr:eq('+startIndex+')');
			if (row.hasClass('t-selected'))	
			{
				self.unsetSelection(row);
			}
			row.remove();
		}
		
		
		if (removeFromTop) // add removed rows equivalent margin to the top
		{
			self.bd.css('margin-top', (offsetTop + rowNum * self.row_h) + 'px');
		}
		else // ... to the bottom
		{
			self.bd.css('margin-bottom', (offsetBottom + rowNum * self.row_h) + 'px');
		}
		
		self.rowsLoaded -= rowNum;	
	},
	
	
	_queryString: function()
	{
		var self = this;
		
		return {
			page: 1,
			rowsPerPage: self.rowsPerPage	
		};	
	},
	
	
	_makeAjaxRequest: function(args, callback, showLoading)
	{
		var self = this;
		
		(showLoading === true && self.showLoading());
			
		if (self.ajax != null)
		{
			self.ajax.abort();
			self.ajax = null;	
		}
		
		self.ajax = $.post(self.options.url, $.extend(self._queryString(), args), function(data) 
			{
				self.ajax = null;
				(showLoading === true && self.hideLoading());
									
				if ($.isFunction(callback))
					callback.call(self, data);
				
			}, 'json'
		);
	},
	
	
	_uniqid: function()
	{
		return (++this.rowCounter);
	}
	
});

$.extend($.ui.tsort, {
	defaults: {
		model : [
			{
				name: 'Column 1234',
				key: 'column_1',
				hidden: false,	
				width: 100
			},
			{
				name: 'Column 2',
				key: 'column_2',
				hidden: false,
				width:150
			},
			{
				name: 'Column 3',
				key: 'column_3',
				hidden: false,
				width: 200
			}
		]
		
		,order: null
		
		,columnTemplate: 
		{
			name: 'Col $i',
			key: 't-col-$i',
			hidden: false,
			width: 30
		}
		
		,width: 500
		,height: 500
		
		,url: null
		,maxRowsVisible: 200
		,ajaxRequestRate: 250 // ms
		
		,autoPopulate: true
		
		,draggableColumns: true
		,resizableColumns: true
		,maxColWidth: 250
		,autoLoadingRows: true
		,scrollRate: 50
		,rows2Edge: 4
		,selectableRows: true
		,sortableRows: true
	}
		
});