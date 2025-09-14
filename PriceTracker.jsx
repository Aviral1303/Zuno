import React, { useState, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import FilterGroup from './FilterGroup';

/**
 * Price Tracker Chart Component - Multi-line Chart
 * Shows price trends for different products with dummy data
 */
const PriceTracker = ({ data = null }) => {
  // Filter states
  const [selectedCategories, setSelectedCategories] = useState(['Electronics', 'Computers']);
  const [selectedMerchants, setSelectedMerchants] = useState(['Amazon', 'Best Buy', 'Apple Store']);
  const [selectedTimeFrames, setSelectedTimeFrames] = useState(['8 months']);

  // Filter options
  const categoryOptions = [
    { value: 'Electronics', label: 'Electronics' },
    { value: 'Computers', label: 'Computers' },
    { value: 'Phones', label: 'Phones' }
  ];

  const merchantOptions = [
    { value: 'Amazon', label: 'Amazon' },
    { value: 'Best Buy', label: 'Best Buy' },
    { value: 'Apple Store', label: 'Apple Store' },
    { value: 'Walmart', label: 'Walmart' }
  ];

  const timeFrameOptions = [
    { value: '3 months', label: '3 months' },
    { value: '6 months', label: '6 months' },
    { value: '8 months', label: '8 months' }
  ];

  // Dummy data for demonstration
  const defaultData = {
    dates: ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', '2024-07', '2024-08'],
    products: {
      'iPhone 15': [999, 950, 920, 899, 880, 860, 840, 820],
      'Samsung Galaxy S24': [899, 870, 850, 830, 810, 790, 770, 750],
      'MacBook Pro': [1999, 1950, 1920, 1880, 1850, 1820, 1800, 1780]
    }
  };

  const chartData = data || defaultData;

  // Filter data based on selections
  const filteredData = useMemo(() => {
    let dates = chartData.dates;
    let products = { ...chartData.products };

    // Apply time frame filter
    if (selectedTimeFrames.includes('3 months')) {
      dates = dates.slice(-3);
      Object.keys(products).forEach(product => {
        products[product] = products[product].slice(-3);
      });
    } else if (selectedTimeFrames.includes('6 months')) {
      dates = dates.slice(-6);
      Object.keys(products).forEach(product => {
        products[product] = products[product].slice(-6);
      });
    }

    // Apply category and merchant filters (simulate by adjusting product availability)
    const categoryMultiplier = selectedCategories.length / categoryOptions.length;
    const merchantMultiplier = selectedMerchants.length / merchantOptions.length;
    const totalMultiplier = categoryMultiplier * merchantMultiplier;

    if (totalMultiplier < 1) {
      // Remove some products if filters are restrictive
      const productKeys = Object.keys(products);
      const keepCount = Math.max(1, Math.round(productKeys.length * totalMultiplier));
      const filteredProducts = {};
      productKeys.slice(0, keepCount).forEach(key => {
        filteredProducts[key] = products[key];
      });
      products = filteredProducts;
    }

    return { dates, products };
  }, [selectedCategories, selectedMerchants, selectedTimeFrames, chartData]);

  const series = Object.entries(filteredData.products).map(([product, prices], index) => ({
    name: product,
    type: 'line',
    data: prices,
    smooth: true,
    lineStyle: {
      width: 3
    },
    itemStyle: {
      borderWidth: 2,
      borderColor: '#fff'
    }
  }));

  const option = {
    title: {
      text: 'Price Tracker',
      left: 'center',
      textStyle: {
        fontSize: 18,
        fontWeight: 'bold'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function (params) {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach(param => {
          result += `${param.seriesName}: $${param.value}<br/>`;
        });
        return result;
      }
    },
    legend: {
      top: 30,
      data: Object.keys(filteredData.products)
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      top: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: filteredData.dates,
      axisLine: {
        lineStyle: {
          color: '#666'
        }
      }
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '${value}'
      },
      axisLine: {
        lineStyle: {
          color: '#666'
        }
      }
    },
    series: series,
    color: ['#ef4444', '#3b82f6', '#10b981']
  };

  return (
    <div className="w-full">
      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <FilterGroup
          title="Product Category"
          options={categoryOptions}
          selectedValues={selectedCategories}
          onChange={setSelectedCategories}
        />
        <FilterGroup
          title="Merchant"
          options={merchantOptions}
          selectedValues={selectedMerchants}
          onChange={setSelectedMerchants}
        />
        <FilterGroup
          title="Time Frame"
          options={timeFrameOptions}
          selectedValues={selectedTimeFrames}
          onChange={setSelectedTimeFrames}
        />
      </div>
      
      {/* Chart */}
      <div className="h-96">
        <ReactECharts
          option={option}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  );
};

export default PriceTracker;
